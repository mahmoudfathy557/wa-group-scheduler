import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { detectIntervalPattern, validateCronMinInterval } from './cron.helpers';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class SchedulesService implements OnModuleInit {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('message-send') private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    await this.rehydrateRepeats();
  }

  async rehydrateRepeats() {
    const active = await this.prisma.schedule.findMany({
      where: { status: 'active' },
      include: { scheduleGroups: { include: { group: true } } },
    });

    for (const schedule of active) {
      try {
        await this.registerJob(schedule);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to rehydrate schedule ${schedule.id}: ${message}`);
      }
    }

    this.logger.log(`Rehydrated ${active.length} active schedules`);
  }

  async findAll(tenantId: string) {
    return this.prisma.schedule.findMany({
      where: { tenantId },
      include: { scheduleGroups: { include: { group: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { id, tenantId },
      include: { scheduleGroups: { include: { group: true } } },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  private async validateGroupOwnership(tenantId: string, groupIds: string[]) {
    const count = await this.prisma.group.count({
      where: { tenantId, id: { in: groupIds } },
    });

    if (count !== new Set(groupIds).size) {
      throw new BadRequestException('One or more groups are invalid for this tenant');
    }
  }

  async create(tenantId: string, dto: CreateScheduleDto) {
    if (!dto.cronExpr && !dto.intervalMs) {
      throw new BadRequestException('Either cronExpr or intervalMs must be provided');
    }

    if (dto.cronExpr && dto.intervalMs) {
      throw new BadRequestException('Provide either cronExpr or intervalMs, not both');
    }

    await this.validateGroupOwnership(tenantId, dto.groupIds);

    const timezone = dto.timezone || 'UTC';
    if (dto.cronExpr) {
      try {
        validateCronMinInterval(dto.cronExpr, timezone);
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : String(error));
      }
    }

    const schedule = await this.prisma.schedule.create({
      data: {
        tenantId,
        name: dto.name,
        message: dto.message,
        cronExpr: dto.cronExpr || null,
        timezone,
        intervalMs: dto.intervalMs ? BigInt(dto.intervalMs) : null,
        anchorDate: dto.intervalMs ? new Date() : null,
        imageUrls: dto.imageUrls || [],
        status: 'active',
        scheduleGroups: {
          create: dto.groupIds.map((groupId) => ({ groupId })),
        },
      },
      include: { scheduleGroups: { include: { group: true } } },
    });

    await this.registerJob(schedule);
    return schedule;
  }

  async update(tenantId: string, id: string, dto: UpdateScheduleDto) {
    const existing = await this.findOne(tenantId, id);

    const nextCron = dto.cronExpr !== undefined ? dto.cronExpr : existing.cronExpr;
    const nextInterval =
      dto.intervalMs !== undefined
        ? dto.intervalMs
        : existing.intervalMs
          ? Number(existing.intervalMs)
          : undefined;

    if (!nextCron && !nextInterval) {
      throw new BadRequestException('Either cronExpr or intervalMs must be provided');
    }

    if (nextCron && nextInterval) {
      throw new BadRequestException('Provide either cronExpr or intervalMs, not both');
    }

    if (dto.groupIds) {
      await this.validateGroupOwnership(tenantId, dto.groupIds);
    }

    const timezone = dto.timezone || existing.timezone;
    if (nextCron) {
      try {
        validateCronMinInterval(nextCron, timezone);
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : String(error));
      }
    }

    await this.removeJob(id);

    const updated = await this.prisma.schedule.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        message: dto.message ?? existing.message,
        cronExpr: dto.cronExpr !== undefined ? dto.cronExpr : existing.cronExpr,
        timezone,
        intervalMs:
          dto.intervalMs !== undefined
            ? dto.intervalMs
              ? BigInt(dto.intervalMs)
              : null
            : existing.intervalMs,
        anchorDate: dto.intervalMs !== undefined ? new Date() : existing.anchorDate,
        imageUrls: dto.imageUrls !== undefined ? dto.imageUrls : existing.imageUrls,
        scheduleGroups: dto.groupIds
          ? {
              deleteMany: {},
              create: dto.groupIds.map((groupId) => ({ groupId })),
            }
          : undefined,
      },
      include: { scheduleGroups: { include: { group: true } } },
    });

    if (updated.status === 'active') {
      await this.registerJob(updated);
    }

    return updated;
  }

  async pause(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.removeJob(id);
    return this.prisma.schedule.update({
      where: { id },
      data: { status: 'paused' },
    });
  }

  async resume(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.schedule.update({
      where: { id },
      data: { anchorDate: new Date(), status: 'active' },
    });
    const updated = await this.findOne(tenantId, id);
    await this.registerJob(updated);
    return updated;
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.removeJob(id);
    await this.prisma.schedule.delete({ where: { id } });
    return { deleted: true };
  }

  private async registerJob(schedule: any) {
    const jobData = { scheduleId: schedule.id, tenantId: schedule.tenantId };

    if (schedule.cronExpr) {
      const detected = detectIntervalPattern(schedule.cronExpr);
      if (detected.isInterval && detected.everyMs) {
        await this.queue.add('send', jobData, {
          jobId: schedule.id,
          repeat: {
            every: detected.everyMs,
            startDate: schedule.anchorDate || new Date(),
          },
        });
        return;
      }

      await this.queue.add('send', jobData, {
        jobId: schedule.id,
        repeat: {
          pattern: schedule.cronExpr,
          tz: schedule.timezone,
        },
      });
      return;
    }

    if (schedule.intervalMs) {
      await this.queue.add('send', jobData, {
        jobId: schedule.id,
        repeat: {
          every: Number(schedule.intervalMs),
          startDate: schedule.anchorDate || new Date(),
        },
      });
    }
  }

  private async removeJob(scheduleId: string) {
    try {
      const repeatable = await this.queue.getRepeatableJobs();
      for (const job of repeatable) {
        if (job.id === scheduleId || job.key.includes(scheduleId)) {
          await this.queue.removeRepeatableByKey(job.key);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to remove job for schedule ${scheduleId}: ${message}`);
    }
  }
}
