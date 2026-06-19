import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { randomUUID } from "crypto";
import parser from "cron-parser";
import { PrismaService } from "../prisma/prisma.service";
import { MESSAGE_SEND_QUEUE, SCHEDULE_TRIGGER_QUEUE } from "./queue.constants";
import { CRON_MIN_INTERVAL_ERROR_MESSAGE, isValidCron } from "./dto";

interface TriggerJobData {
  scheduleId: string;
  tenantId: string;
}

interface SendJobData {
  tenantId: string;
  scheduleId: string;
  runId: string;
  groupJid: string;
  messageText: string;
  imageUrls: string[];
  logId: string;
  // Index in the fan-out — used for jittered staggering.
  index: number;
}

const SEND_ATTEMPTS = 3;
const SEND_BACKOFF_MS = 5000;

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

/**
 * Receives one tick from the cron repeatable, snapshots the schedule
 * (text + groups) and enqueues one `message-send` job per group.
 */
@Processor(SCHEDULE_TRIGGER_QUEUE)
export class ScheduleTriggerProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduleTriggerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(MESSAGE_SEND_QUEUE)
    private readonly sendQueue: Queue<SendJobData>
  ) {
    super();
  }

  async process(job: Job<TriggerJobData>): Promise<void> {
    const { scheduleId, tenantId } = job.data;

    const schedule = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, tenantId, status: "active" },
      include: { groupLinks: { include: { group: true } } }
    });
    if (!schedule) {
      this.logger.warn(`Trigger ${scheduleId}: schedule missing or paused`);
      return;
    }

    if (!isValidCron(schedule.cronExpression, schedule.timezone)) {
      this.logger.warn(
        `Trigger ${scheduleId}: skipped. ${CRON_MIN_INTERVAL_ERROR_MESSAGE}`
      );
      return;
    }

    const runId = randomUUID();
    const links = schedule.groupLinks;
    if (links.length === 0) {
      this.logger.warn(`Trigger ${scheduleId}: no groups linked`);
      return;
    }

    // Pre-create pending logs in one transaction so the daily-cap counter is accurate.
    const created = await this.prisma.$transaction(
      links.map((l, i) =>
        this.prisma.messageLog.create({
          data: {
            tenantId,
            scheduleId,
            runId,
            groupJid: l.group.groupJid,
            status: "pending"
          }
        })
      )
    );

    const jobs = links.map((link, i) => ({
      name: "send",
      data: {
        tenantId,
        scheduleId,
        runId,
        groupJid: link.group.groupJid,
        messageText: schedule.messageText,
        imageUrls: schedule.imageUrls,
        logId: created[i].id,
        index: i
      },
      opts: {
        // Make each message log id the dedupe key for first dispatch.
        jobId: created[i].id,
        attempts: SEND_ATTEMPTS,
        backoff: { type: "exponential", delay: SEND_BACKOFF_MS },
        // Message history is stored in DB; free queue slots for future retries.
        removeOnComplete: true,
        removeOnFail: true
      }
    }));

    try {
      await this.sendQueue.addBulk(jobs);
    } catch (error: any) {
      // Best-effort fallback: enqueue each item individually.
      let failedToQueue = 0;
      for (const jobDef of jobs) {
        try {
          await this.sendQueue.add(jobDef.name, jobDef.data, jobDef.opts);
        } catch (jobErr: any) {
          failedToQueue++;
          this.logger.error(
            `Trigger ${scheduleId}: fallback enqueue failed for logId=${jobDef.data.logId} groupJid=${jobDef.data.groupJid}: ${jobErr?.message}`,
            jobErr?.stack
          );
        }
      }

      if (failedToQueue > 0) {
        await this.prisma.messageLog.updateMany({
          where: {
            id: { in: created.map((c) => c.id) },
            status: "pending"
          },
          data: { errorReason: "enqueue_pending_retry" }
        });
      }

      this.logger.error(
        `Trigger ${scheduleId}: addBulk enqueue failed; fallback failed for ${failedToQueue}/${jobs.length}`,
        error?.stack || error?.message || String(error)
      );
    }

    // Update nextRunAt projection.
    try {
      const next =
        schedule.intervalMinutes && schedule.intervalAnchorAt
          ? nextRunFromAnchor(
              schedule.intervalAnchorAt,
              schedule.intervalMinutes
            )
          : parser
              .parseExpression(schedule.cronExpression, {
                tz: schedule.timezone,
                currentDate: new Date()
              })
              .next()
              .toDate();
      await this.prisma.schedule.update({
        where: { id: scheduleId },
        data: { nextRunAt: next }
      });
    } catch {
      /* ignore */
    }
  }
}
