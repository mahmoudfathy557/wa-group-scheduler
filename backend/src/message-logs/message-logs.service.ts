import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessageLogsService {
  private readonly logger = new Logger(MessageLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, page = 1, limit = 50) {
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(100, Math.max(1, limit));
    const skip = (normalizedPage - 1) * normalizedLimit;

    const [items, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: normalizedLimit,
      }),
      this.prisma.messageLog.count({ where: { tenantId } }),
    ]);

    return { items, total, page: normalizedPage, limit: normalizedLimit };
  }

  @Cron('0 3 * * *')
  async pruneOldLogs() {
    const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS || '7', 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await this.prisma.messageLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    this.logger.log(`Pruned ${result.count} message logs older than ${retentionDays} days`);
  }
}
