import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import parser from "cron-parser";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../common/tenant-context";
import { CreateScheduleDto, UpdateScheduleDto, isValidCron } from "./dto";
import { SCHEDULE_TRIGGER_QUEUE } from "./queue.constants";

interface TriggerJobData {
  scheduleId: string;
  tenantId: string;
}

@Injectable()
export class SchedulesService {
  constructor(
    private readonly tprisma: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    @InjectQueue(SCHEDULE_TRIGGER_QUEUE)
    private readonly triggerQueue: Queue<TriggerJobData>
  ) {}

  async list() {
    const client: any = this.tprisma.client;
    return client.schedule.findMany({
      orderBy: { createdAt: "desc" },
      include: { groupLinks: { include: { group: true } } }
    });
  }

  async get(id: string) {
    const client: any = this.tprisma.client;
    const s = await client.schedule.findFirst({
      where: { id },
      include: { groupLinks: { include: { group: true } } }
    });
    if (!s) throw new NotFoundException();
    return s;
  }

  async create(dto: CreateScheduleDto) {
    if (!isValidCron(dto.cronExpression, dto.timezone)) {
      throw new BadRequestException("Invalid cron expression or timezone");
    }
    const client: any = this.tprisma.client;
    const tenantId = this.ctx.requireTenantId();

    // Validate groups belong to tenant.
    const groups = await client.group.findMany({
      where: { id: { in: dto.groupIds } }
    });
    if (groups.length !== dto.groupIds.length) {
      throw new BadRequestException("One or more groups not found");
    }

    const nextRunAt = nextRun(dto.cronExpression, dto.timezone);

    const created = await client.schedule.create({
      data: {
        messageText: dto.messageText,
        cronExpression: dto.cronExpression,
        timezone: dto.timezone,
        nextRunAt,
        groupLinks: { create: dto.groupIds.map((groupId) => ({ groupId })) }
      },
      include: { groupLinks: { include: { group: true } } }
    });

    const repeatJobKey = await this.upsertRepeat(
      created.id,
      tenantId,
      dto.cronExpression,
      dto.timezone
    );
    await this.prisma.schedule.update({
      where: { id: created.id },
      data: { repeatJobKey }
    });

    return this.get(created.id);
  }

  async update(id: string, dto: UpdateScheduleDto) {
    const existing = await this.get(id);
    const client: any = this.tprisma.client;
    const tenantId = this.ctx.requireTenantId();

    const cron = dto.cronExpression ?? existing.cronExpression;
    const tz = dto.timezone ?? existing.timezone;
    if (dto.cronExpression || dto.timezone) {
      if (!isValidCron(cron, tz))
        throw new BadRequestException("Invalid cron expression or timezone");
    }

    const data: any = {};
    if (dto.messageText !== undefined) data.messageText = dto.messageText;
    if (dto.cronExpression !== undefined)
      data.cronExpression = dto.cronExpression;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.cronExpression || dto.timezone) data.nextRunAt = nextRun(cron, tz);

    if (dto.groupIds) {
      const groups = await client.group.findMany({
        where: { id: { in: dto.groupIds } }
      });
      if (groups.length !== dto.groupIds.length) {
        throw new BadRequestException("One or more groups not found");
      }
      await client.scheduleGroup.deleteMany({ where: { scheduleId: id } });
      data.groupLinks = {
        create: dto.groupIds.map((groupId) => ({ groupId }))
      };
    }

    await this.prisma.schedule.update({ where: { id }, data });

    // Recompute repeat job. Always remove old, add new (unless paused).
    if (existing.repeatJobKey) {
      await this.removeRepeat(existing.repeatJobKey);
    }
    const finalStatus = dto.status ?? existing.status;
    if (finalStatus === "active") {
      const repeatJobKey = await this.upsertRepeat(id, tenantId, cron, tz);
      await this.prisma.schedule.update({
        where: { id },
        data: { repeatJobKey }
      });
    } else {
      await this.prisma.schedule.update({
        where: { id },
        data: { repeatJobKey: null }
      });
    }

    return this.get(id);
  }

  async remove(id: string) {
    const existing = await this.get(id);
    if (existing.repeatJobKey) {
      await this.removeRepeat(existing.repeatJobKey);
    }
    await this.prisma.schedule.delete({ where: { id } });
    return { ok: true };
  }

  async pause(id: string) {
    return this.update(id, { status: "paused" });
  }

  async resume(id: string) {
    return this.update(id, { status: "active" });
  }

  /**
   * Bootstrap helper, called from a startup hook to ensure all active schedules
   * have repeatable jobs registered (handles fresh restart on different Redis).
   */
  async rehydrateRepeats(
    allActive: Array<{
      id: string;
      tenantId: string;
      cronExpression: string;
      timezone: string;
      repeatJobKey: string | null;
    }>
  ) {
    for (const s of allActive) {
      if (!s.repeatJobKey) {
        await this.upsertRepeat(s.id, s.tenantId, s.cronExpression, s.timezone);
      }
    }
  }

  private async upsertRepeat(
    scheduleId: string,
    tenantId: string,
    cron: string,
    tz: string
  ): Promise<string> {
    // jobId == scheduleId so we can deterministically remove later.
    const jobName = "trigger";
    await this.triggerQueue.add(
      jobName,
      { scheduleId, tenantId },
      {
        repeat: { pattern: cron, tz },
        jobId: scheduleId,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 50 }
      }
    );
    // Compose a deterministic repeat key; BullMQ uses pattern+tz+name+jobId internally.
    return `${jobName}:${scheduleId}:${tz}:${cron}`;
  }

  private async removeRepeat(repeatJobKey: string): Promise<void> {
    const [, scheduleId, tz, ...patternParts] = repeatJobKey.split(":");
    const pattern = patternParts.join(":");
    try {
      await this.triggerQueue.removeRepeatable(
        "trigger",
        { pattern, tz },
        scheduleId
      );
    } catch {
      /* ignore — best-effort cleanup */
    }
  }
}

function nextRun(cron: string, tz: string): Date {
  const it = parser.parseExpression(cron, { tz });
  return it.next().toDate();
}
