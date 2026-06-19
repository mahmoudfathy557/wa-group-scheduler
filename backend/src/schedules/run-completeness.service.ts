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

const REPAIR_ATTEMPTS = 3;
const REPAIR_BACKOFF_MS = 5000;

@Injectable()
export class RunCompletenessService {
  private readonly logger = new Logger(RunCompletenessService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(MESSAGE_SEND_QUEUE)
    private readonly sendQueue: Queue<SendJobData>
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileRunCompleteness() {
    const lookbackMinutes = parseInt(
      process.env.RUN_COMPLETENESS_LOOKBACK_MINUTES || "90",
      10
    );
    const runBatch = parseInt(process.env.RUN_COMPLETENESS_BATCH || "100", 10);
    const cutoff = new Date(Date.now() - lookbackMinutes * 60_000);

    const recentRuns = await this.prisma.messageLog.findMany({
      where: {
        createdAt: { gte: cutoff }
      },
      select: {
        tenantId: true,
        scheduleId: true,
        runId: true
      },
      distinct: ["tenantId", "scheduleId", "runId"],
      orderBy: { createdAt: "desc" },
      take: runBatch
    });

    if (recentRuns.length === 0) {
      return;
    }

    let repairedRuns = 0;
    let repairedLogs = 0;

    for (const run of recentRuns) {
      const schedule = await this.prisma.schedule.findFirst({
        where: {
          id: run.scheduleId,
          tenantId: run.tenantId,
          status: "active"
        },
        include: {
          groupLinks: {
            include: {
              group: {
                select: { groupJid: true }
              }
            }
          }
        }
      });

      if (!schedule || schedule.groupLinks.length === 0) {
        continue;
      }

      const expectedGroupJids = schedule.groupLinks.map(
        (l) => l.group.groupJid
      );
      const existingLogs = await this.prisma.messageLog.findMany({
        where: {
          tenantId: run.tenantId,
          scheduleId: run.scheduleId,
          runId: run.runId
        },
        select: {
          groupJid: true
        }
      });

      const existingSet = new Set(existingLogs.map((l) => l.groupJid));
      // Start from groups missing for this runId
      let missing = expectedGroupJids.filter((jid) => !existingSet.has(jid));

      // Defensive: if a message for this schedule+group was already sent
      // (possibly under a different runId), skip repair to avoid duplicate sends.
      if (missing.length > 0) {
        const alreadySent = await this.prisma.messageLog.findMany({
          where: {
            tenantId: run.tenantId,
            scheduleId: run.scheduleId,
            groupJid: { in: missing },
            status: "sent"
          },
          select: { groupJid: true }
        });
        if (alreadySent.length > 0) {
          const sentSet = new Set(alreadySent.map((s) => s.groupJid));
          missing = missing.filter((jid) => !sentSet.has(jid));
        }
      }

      if (missing.length === 0) {
        continue;
      }

      repairedRuns++;

      const pendingRequeueAfterMs = parseInt(
        process.env.PENDING_REQUEUE_AFTER_MS || "120000",
        10
      );

      for (const [index, groupJid] of missing.entries()) {
        try {
          // Determine the group's original fan-out index from the schedule
          // ordering so jittering remains stable and predictable.
          const groupIndex = schedule.groupLinks.findIndex(
            (l) => l.group.groupJid === groupJid
          );
          const jobIndex =
            groupIndex >= 0 ? groupIndex : existingLogs.length + index;

          // If there's an existing pending log for this schedule+group, prefer to
          // reuse/requeue it instead of creating a new log to avoid duplicates.
          const existingPending = await this.prisma.messageLog.findFirst({
            where: {
              tenantId: run.tenantId,
              scheduleId: run.scheduleId,
              groupJid,
              status: "pending"
            },
            select: { id: true, createdAt: true, runId: true },
            orderBy: { createdAt: "asc" }
          });

          if (existingPending) {
            const age = Date.now() - existingPending.createdAt.getTime();
            if (age >= pendingRequeueAfterMs) {
              // Requeue the existing pending log and mark it so it won't be
              // re-repaired repeatedly.
              await this.sendQueue.add(
                "send",
                {
                  tenantId: run.tenantId,
                  scheduleId: run.scheduleId,
                  runId: existingPending.runId,
                  groupJid,
                  messageText: schedule.messageText,
                  imageUrls: schedule.imageUrls,
                  logId: existingPending.id,
                  index: jobIndex
                },
                {
                  jobId: existingPending.id,
                  attempts: REPAIR_ATTEMPTS,
                  backoff: { type: "exponential", delay: REPAIR_BACKOFF_MS },
                  removeOnComplete: true,
                  removeOnFail: true
                }
              );

              await this.prisma.messageLog.update({
                where: { id: existingPending.id },
                data: { errorReason: "stale_pending_requeued" }
              });

              repairedLogs++;
              continue;
            }

            // Recent pending exists — skip repairing this group for now.
            continue;
          }

          // No pending found: create a new pending log and enqueue send job.
          const created = await this.prisma.messageLog.create({
            data: {
              tenantId: run.tenantId,
              scheduleId: run.scheduleId,
              runId: run.runId,
              groupJid,
              status: "pending",
              errorReason: "run_completion_repair"
            },
            select: { id: true }
          });

          await this.sendQueue.add(
            "send",
            {
              tenantId: run.tenantId,
              scheduleId: run.scheduleId,
              runId: run.runId,
              groupJid,
              messageText: schedule.messageText,
              imageUrls: schedule.imageUrls,
              logId: created.id,
              index: jobIndex
            },
            {
              jobId: created.id,
              attempts: REPAIR_ATTEMPTS,
              backoff: { type: "exponential", delay: REPAIR_BACKOFF_MS },
              removeOnComplete: true,
              removeOnFail: true
            }
          );

          repairedLogs++;
        } catch (repairErr: any) {
          // Likely a duplicate key race with another repair path; log at debug level.
          this.logger.debug(
            `Run completeness: skipped repair for groupJid=${groupJid} runId=${run.runId}: ${repairErr?.message}`
          );
        }
      }
    }

    if (repairedLogs > 0) {
      this.logger.warn(
        `Run completeness repaired ${repairedLogs} missing logs across ${repairedRuns} runs`
      );
    }
  }
}
