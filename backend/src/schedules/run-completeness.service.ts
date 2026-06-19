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
      const missing = expectedGroupJids.filter((jid) => !existingSet.has(jid));

      if (missing.length === 0) {
        continue;
      }

      repairedRuns++;

      for (const [index, groupJid] of missing.entries()) {
        try {
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
              index: existingLogs.length + index
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
        } catch {
          // If another path repaired first, skip silently and continue.
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
