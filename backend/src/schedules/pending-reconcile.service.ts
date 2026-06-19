import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { MESSAGE_SEND_QUEUE } from "./queue.constants";

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

const REQUEUE_ATTEMPTS = 3;
const REQUEUE_BACKOFF_MS = 5000;

@Injectable()
export class PendingReconcileService {
  private readonly logger = new Logger(PendingReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(MESSAGE_SEND_QUEUE)
    private readonly sendQueue: Queue<SendJobData>
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcilePendingLogs() {
    const staleAfterMs = parseInt(
      process.env.PENDING_REQUEUE_AFTER_MS || "120000",
      10
    );
    const batchSize = parseInt(process.env.PENDING_REQUEUE_BATCH || "200", 10);
    const cutoff = new Date(Date.now() - staleAfterMs);

    const stalePending = await this.prisma.messageLog.findMany({
      where: {
        status: "pending",
        createdAt: { lte: cutoff },
        NOT: { errorReason: "stale_pending_requeued" },
        schedule: { status: "active" }
      },
      include: {
        schedule: {
          select: {
            messageText: true,
            imageUrls: true
          }
        }
      },
      orderBy: { createdAt: "asc" },
      take: batchSize
    });

    if (stalePending.length === 0) {
      return;
    }

    let queued = 0;
    for (const log of stalePending) {
      try {
        await this.sendQueue.add(
          "send",
          {
            tenantId: log.tenantId,
            scheduleId: log.scheduleId,
            runId: log.runId,
            groupJid: log.groupJid,
            messageText: log.schedule.messageText,
            imageUrls: log.schedule.imageUrls,
            logId: log.id,
            index: 0
          },
          {
            // Mark the log so the next cron pass does not enqueue it again.
            jobId: `${log.id}:reconcile:${Date.now()}:${Math.floor(Math.random() * 1000)}`,
            attempts: REQUEUE_ATTEMPTS,
            backoff: { type: "exponential", delay: REQUEUE_BACKOFF_MS },
            removeOnComplete: true,
            removeOnFail: true
          }
        );
        await this.prisma.messageLog.update({
          where: { id: log.id },
          data: { errorReason: "stale_pending_requeued" }
        });
        queued++;
      } catch {
        // Best effort; leave pending for next reconcile cycle.
      }
    }

    this.logger.log(
      `Reconcile queued ${queued}/${stalePending.length} stale pending logs`
    );
  }
}
