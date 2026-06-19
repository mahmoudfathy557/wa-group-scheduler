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
import {
  CRON_MIN_INTERVAL_ERROR_MESSAGE,
  CreateScheduleDto,
  UpdateScheduleDto,
  isValidCron
} from "./dto";
import { SCHEDULE_TRIGGER_QUEUE } from "./queue.constants";

interface TriggerJobData {
  scheduleId: string;
  tenantId: string;
}

function parseIntervalFromCron(expr: string): number | null {
  const cron = expr.trim();
  const everyMinutes = cron.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (everyMinutes) return Number(everyMinutes[1]);

  const everyHours = cron.match(/^0\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
  if (everyHours) return Number(everyHours[1]) * 60;

  return null;
}

function nextRunFromAnchor(
  anchorAt: Date,
  intervalMinutes: number,
  now = new Date()
): Date {
  const stepMs = intervalMinutes * 60_000;
  const anchorMs = anchorAt.getTime();
  const nowMs = now.getTime();

  if (nowMs < anchorMs) return anchorAt;

  const elapsed = nowMs - anchorMs;
  const steps = Math.floor(elapsed / stepMs) + 1;
  return new Date(anchorMs + steps * stepMs);
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
      throw new BadRequestException(
        `Invalid cron expression/timezone. ${CRON_MIN_INTERVAL_ERROR_MESSAGE}.`
      );
    }
    const client: any = this.tprisma.client;
    const tenantId = this.ctx.requireTenantId();
    const intervalMinutes = parseIntervalFromCron(dto.cronExpression);
    const intervalAnchorAt = intervalMinutes ? new Date() : null;

    // Validate groups belong to tenant.
    const groups = await client.group.findMany({
      where: { id: { in: dto.groupIds } }
    });
    if (groups.length !== dto.groupIds.length) {
      throw new BadRequestException("One or more groups not found");
    }

    const nextRunAt = intervalMinutes
      ? nextRunFromAnchor(intervalAnchorAt as Date, intervalMinutes)
      : nextRun(dto.cronExpression, dto.timezone);

    const created = await client.schedule.create({
      data: {
        messageText: dto.messageText,
        cronExpression: dto.cronExpression,
        timezone: dto.timezone,
        intervalMinutes,
        intervalAnchorAt,
        imageUrls: dto.imageUrls ?? [],
        nextRunAt,
        groupLinks: { create: dto.groupIds.map((groupId) => ({ groupId })) }
      },
      include: { groupLinks: { include: { group: true } } }
    });

    const repeatJobKey = await this.upsertRepeat(
      created.id,
      tenantId,
      dto.cronExpression,
      dto.timezone,
      intervalMinutes,
      intervalAnchorAt
    );
    await this.prisma.schedule.update({
      where: { id: created.id },
      data: { repeatJobKey }
    });

    if (dto.runNow) {
      await this.enqueueImmediateTrigger(created.id, tenantId);
    }

    return this.get(created.id);
  }

  async update(id: string, dto: UpdateScheduleDto) {
    const existing = await this.get(id);
    const client: any = this.tprisma.client;
    const tenantId = this.ctx.requireTenantId();

    const cron = dto.cronExpression ?? existing.cronExpression;
    const tz = dto.timezone ?? existing.timezone;
    const isIntervalSchedule = parseIntervalFromCron(cron);
    const shouldResetIntervalAnchor =
      dto.cronExpression !== undefined || dto.status === "active";
    const intervalMinutes = isIntervalSchedule;
    const intervalAnchorAt = intervalMinutes
      ? shouldResetIntervalAnchor
        ? new Date()
        : (existing.intervalAnchorAt ?? new Date())
      : null;
    if (dto.cronExpression || dto.timezone) {
      if (!isValidCron(cron, tz))
        throw new BadRequestException(
          `Invalid cron expression/timezone. ${CRON_MIN_INTERVAL_ERROR_MESSAGE}.`
        );
    }

    const data: any = {};
    if (dto.messageText !== undefined) data.messageText = dto.messageText;
    if (dto.cronExpression !== undefined)
      data.cronExpression = dto.cronExpression;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.imageUrls !== undefined) data.imageUrls = dto.imageUrls;
    if (dto.cronExpression !== undefined || dto.status === "active") {
      data.intervalMinutes = intervalMinutes;
      data.intervalAnchorAt = intervalAnchorAt;
      data.nextRunAt = intervalMinutes
        ? nextRunFromAnchor(intervalAnchorAt as Date, intervalMinutes)
        : nextRun(cron, tz);
    }

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
      const repeatJobKey = await this.upsertRepeat(
        id,
        tenantId,
        cron,
        tz,
        intervalMinutes,
        intervalAnchorAt
      );
      await this.prisma.schedule.update({
        where: { id },
        data: { repeatJobKey }
      });

      if (dto.runNow) {
        await this.enqueueImmediateTrigger(id, tenantId);
      }
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
   * Auto-pause all active schedules for a tenant when disconnect event fires.
   * Used to prevent stale trigger attempts while tenant connection is down.
   * Idempotent: repeated calls do nothing (schedules already paused).
   */
  async pauseAllActive() {
    const tenantId = this.ctx.requireTenantId();
    const client: any = this.tprisma.client;

    // Find all active schedules for this tenant.
    const active = await client.schedule.findMany({
      where: { status: "active" }
    });

    if (active.length === 0) {
      return { pausedCount: 0 };
    }

    // Pause all at once via updateMany (faster than individual updates).
    const activeIds = active.map((s: any) => s.id);
    const result = await client.schedule.updateMany({
      where: { id: { in: activeIds } },
      data: { status: "paused" }
    });

    // Cleanup: remove repeatable jobs from queue and clear state.
    await this.cleanupScheduleRepeatJobs(active, activeIds);

    return { pausedCount: result.count };
  }

  /**
   * Helper: remove repeatable jobs from queue and clear repeatJobKey from shared schema.
   * This prevents re-hydration on restart and orphaned jobs in the queue.
   */
  private async cleanupScheduleRepeatJobs(
    active: Array<any>,
    activeIds: string[]
  ): Promise<void> {
    // Remove repeatable jobs from the queue for each schedule.
    for (const schedule of active) {
      if (schedule.repeatJobKey) {
        await this.removeRepeat(schedule.repeatJobKey);
      }
    }

    // Clear the repeatJobKey in the shared schema so we don't re-hydrate on restart.
    await this.prisma.schedule.updateMany({
      where: { id: { in: activeIds } },
      data: { repeatJobKey: null }
    });
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
    tz: string,
    intervalMinutes?: number | null,
    intervalAnchorAt?: Date | null
  ): Promise<string> {
    if (!isValidCron(cron, tz)) {
      throw new BadRequestException(CRON_MIN_INTERVAL_ERROR_MESSAGE);
    }

    // jobId == scheduleId so we can deterministically remove later.
    const jobName = "trigger";
    if (intervalMinutes && intervalAnchorAt) {
      const everyMs = intervalMinutes * 60_000;
      await this.triggerQueue.add(
        jobName,
        { scheduleId, tenantId },
        {
          repeat: { every: everyMs, startDate: intervalAnchorAt },
          jobId: scheduleId,
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 50 }
        }
      );
      return `every:${jobName}:${scheduleId}:${everyMs}:${intervalAnchorAt.toISOString()}`;
    }

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
    return `cron:${jobName}:${scheduleId}:${tz}:${cron}`;
  }

  private async enqueueImmediateTrigger(
    scheduleId: string,
    tenantId: string
  ): Promise<void> {
    await this.triggerQueue.add(
      "trigger",
      { scheduleId, tenantId },
      {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 50 }
      }
    );
  }

  private async removeRepeat(repeatJobKey: string): Promise<void> {
    const parts = repeatJobKey.split(":");
    try {
      if (parts[0] === "trigger") {
        const [jobName, scheduleId, tz, ...patternParts] = parts;
        const pattern = patternParts.join(":");
        await this.triggerQueue.removeRepeatable(
          jobName,
          { pattern, tz },
          scheduleId
        );
        return;
      }

      if (parts[0] === "every") {
        const [, jobName, scheduleId, everyMs, ...startDateParts] = parts;
        const startDateIso = startDateParts.join(":");
        await this.triggerQueue.removeRepeatable(
          jobName,
          { every: Number(everyMs), startDate: new Date(startDateIso) },
          scheduleId
        );
        return;
      }

      const [, jobName, scheduleId, tz, ...patternParts] = parts;
      const pattern = patternParts.join(":");
      await this.triggerQueue.removeRepeatable(
        jobName,
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
