import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Hard 7-day retention on MessageLog (configurable via LOG_RETENTION_DAYS).
 */
@Injectable()
export class LogsCleanupService {
  private readonly logger = new Logger(LogsCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanup() {
    const days = parseInt(process.env.LOG_RETENTION_DAYS || "7", 10);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const res = await this.prisma.messageLog.deleteMany({
      where: { createdAt: { lt: cutoff } }
    });
    this.logger.log(`Pruned ${res.count} message logs older than ${days} days`);
  }
}
