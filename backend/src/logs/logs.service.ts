import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import parser from "cron-parser";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { MESSAGE_SEND_QUEUE } from "../schedules/queue.constants";

interface SendJobData {
  tenantId: string;
  scheduleId: string;
  runId: string;
  groupJid: string;
  messageText: string;
  imageUrls: string[];
  logId: string;
  index: number;
}

const SEND_ATTEMPTS = 3;
const SEND_BACKOFF_MS = 5000;

@Injectable()
export class LogsService {
  constructor(
    private readonly tprisma: TenantPrismaService,
    @InjectQueue(MESSAGE_SEND_QUEUE)
    private readonly sendQueue: Queue<SendJobData>
  ) {}

  private computeNextRetryAt(
    status: string,
    schedule?: {
      cronExpression: string;
      timezone: string;
      nextRunAt: Date | null;
    } | null
  ): string | null {
    if (status === "sent" || !schedule) return null;

    const now = new Date();
    if (schedule.nextRunAt && schedule.nextRunAt > now) {
      return schedule.nextRunAt.toISOString();
    }

    try {
      return parser
        .parseExpression(schedule.cronExpression, { tz: schedule.timezone })
        .next()
        .toDate()
        .toISOString();
    } catch {
      return schedule.nextRunAt ? schedule.nextRunAt.toISOString() : null;
    }
  }

  async list(query: {
    scheduleId?: string;
    status?: string;
    take?: number;
    skip?: number;
  }) {
    const client: any = this.tprisma.client;
    const viewState = await client.logViewState.findFirst();

    const where: any = {};
    if (query.scheduleId) where.scheduleId = query.scheduleId;
    if (query.status) where.status = query.status;
    if (viewState?.logsClearedAt) {
      where.createdAt = { gt: viewState.logsClearedAt };
    }

    const logs = await client.messageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(query.take ?? 50, 200),
      skip: query.skip ?? 0,
      include: {
        schedule: {
          select: {
            cronExpression: true,
            timezone: true,
            nextRunAt: true
          }
        }
      }
    });

    return logs.map((log: any) => {
      const { schedule, ...rest } = log;
      return {
        ...rest,
        nextRetryAt: this.computeNextRetryAt(log.status, schedule)
      };
    });
  }

  async resend(logId: string) {
    const client: any = this.tprisma.client;
    const sourceLog = await client.messageLog.findFirst({
      where: { id: logId },
      include: {
        schedule: {
          select: {
            id: true,
            messageText: true,
            imageUrls: true
          }
        }
      }
    });

    if (!sourceLog) {
      throw new NotFoundException("Message log not found");
    }

    if (sourceLog.status === "sent") {
      throw new BadRequestException("Message is already sent");
    }

    if (!sourceLog.schedule) {
      throw new BadRequestException("Schedule not found for this message log");
    }

    const runId = randomUUID();
    const retryLog = await client.messageLog.create({
      data: {
        scheduleId: sourceLog.scheduleId,
        runId,
        groupJid: sourceLog.groupJid,
        status: "pending"
      }
    });

    await this.sendQueue.add(
      "send",
      {
        tenantId: sourceLog.tenantId,
        scheduleId: sourceLog.scheduleId,
        runId,
        groupJid: sourceLog.groupJid,
        messageText: sourceLog.schedule.messageText,
        imageUrls: sourceLog.schedule.imageUrls,
        logId: retryLog.id,
        index: 0
      },
      {
        jobId: retryLog.id,
        attempts: SEND_ATTEMPTS,
        backoff: { type: "exponential", delay: SEND_BACKOFF_MS },
        removeOnComplete: true,
        removeOnFail: true
      }
    );

    // Mark original log as manually requeued so reconcile service skips it
    await client.messageLog.update({
      where: { id: sourceLog.id },
      data: { errorReason: "requeued_manually" }
    });

    return { queued: true, logId: retryLog.id };
  }

  async clearView() {
    const client: any = this.tprisma.client;
    const logsClearedAt = new Date();

    const updated = await client.logViewState.updateMany({
      where: {},
      data: { logsClearedAt }
    });

    if (updated.count === 0) {
      await client.logViewState.create({
        data: { logsClearedAt }
      });
    }

    return { logsClearedAt };
  }

  async stats() {
    const client: any = this.tprisma.client;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const stalePendingCutoff = new Date(Date.now() - 2 * 60 * 1000);
    const retryPendingCutoff = new Date(Date.now() - 10 * 60 * 1000);
    const [sent, failed, pending, sentToday] = await Promise.all([
      client.messageLog.count({ where: { status: "sent" } }),
      client.messageLog.count({ where: { status: "failed" } }),
      client.messageLog.count({ where: { status: "pending" } }),
      client.messageLog.count({
        where: { status: "sent", createdAt: { gte: today } }
      })
    ]);

    const [stalePending, longPending, pendingAwaitingEnqueue] =
      await Promise.all([
        client.messageLog.count({
          where: {
            status: "pending",
            createdAt: { lte: stalePendingCutoff }
          }
        }),
        client.messageLog.count({
          where: {
            status: "pending",
            createdAt: { lte: retryPendingCutoff }
          }
        }),
        client.messageLog.count({
          where: {
            status: "pending",
            errorReason: "enqueue_pending_retry"
          }
        })
      ]);

    return {
      sent,
      failed,
      pending,
      sentToday,
      stalePending,
      longPending,
      pendingAwaitingEnqueue
    };
  }
}
