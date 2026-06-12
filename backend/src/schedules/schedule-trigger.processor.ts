import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { randomUUID } from "crypto";
import parser from "cron-parser";
import { PrismaService } from "../prisma/prisma.service";
import { MESSAGE_SEND_QUEUE, SCHEDULE_TRIGGER_QUEUE } from "./queue.constants";

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
  logId: string;
  // Index in the fan-out — used for jittered staggering.
  index: number;
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

    for (let i = 0; i < links.length; i++) {
      const log = created[i];
      const groupJid = links[i].group.groupJid;
      await this.sendQueue.add(
        "send",
        {
          tenantId,
          scheduleId,
          runId,
          groupJid,
          messageText: schedule.messageText,
          logId: log.id,
          index: i
        },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 100 }
        }
      );
    }

    // Update nextRunAt projection.
    try {
      const next = parser
        .parseExpression(schedule.cronExpression, { tz: schedule.timezone })
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
