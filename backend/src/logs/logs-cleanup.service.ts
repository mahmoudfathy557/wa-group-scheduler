import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Keep pending logs longer than finalized logs so reconciliation has enough
 * history to recover from transient queue/worker outages.
 */
@Injectable()
export class LogsCleanupService {
  private readonly logger = new Logger(LogsCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanup() {
    const finalizedDays = parseInt(process.env.LOG_RETENTION_DAYS || "7", 10);
    const pendingDays = parseInt(
      process.env.PENDING_LOG_RETENTION_DAYS || "30",
      10
    );
    const finalizedCutoff = new Date(
      Date.now() - finalizedDays * 24 * 60 * 60 * 1000
    );
    const pendingCutoff = new Date(
      Date.now() - pendingDays * 24 * 60 * 60 * 1000
    );
    const res = await this.prisma.messageLog.deleteMany({
      where: {
        OR: [
          {
            status: { in: ["sent", "failed"] },
            createdAt: { lt: finalizedCutoff }
          },
          {
            status: "pending",
            createdAt: { lt: pendingCutoff }
          }
        ]
      }
    });
    this.logger.log(
      `Pruned ${res.count} logs (finalized>${finalizedDays}d, pending>${pendingDays}d)`
    );
  }
}
