import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { getDayEndInTimezone, getDayStartInTimezone } from '../schedules/cron.helpers';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const DAILY_CAP = parseInt(process.env.DAILY_MESSAGE_CAP_PER_TENANT || '100', 10);
const DELAY_MIN = parseInt(process.env.MESSAGE_DELAY_MIN_MS || '5000', 10);
const DELAY_MAX = parseInt(process.env.MESSAGE_DELAY_MAX_MS || '10000', 10);

function jitteredDelay(): number {
  return Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN + 1)) + DELAY_MIN;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Processor('message-send')
export class MessageSendProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageSendProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {
    super();
  }

  async process(job: Job) {
    const { scheduleId, tenantId } = job.data as { scheduleId: string; tenantId: string };
    this.logger.log(`Processing schedule ${scheduleId} for tenant ${tenantId}`);

    const schedule = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, tenantId, status: 'active' },
      include: { scheduleGroups: { include: { group: true } } },
    });

    if (!schedule) {
      this.logger.warn(`Schedule ${scheduleId} not found or inactive`);
      return;
    }

    const user = await this.prisma.user.findUnique({ where: { id: tenantId } });
    const timezone = user?.timezone || 'UTC';
    const dayStart = getDayStartInTimezone(timezone);
    const dayEnd = getDayEndInTimezone(timezone);

    const todayCount = await this.prisma.messageLog.count({
      where: {
        tenantId,
        status: { in: ['sent', 'pending'] },
        createdAt: { gte: dayStart, lte: dayEnd },
      },
    });

    const groups = schedule.scheduleGroups.map((item) => item.group);
    const remaining = Math.max(0, DAILY_CAP - todayCount);
    const toProcess = groups.slice(0, remaining);
    const overCap = groups.slice(remaining);
    const scheduledAt = new Date();

    const pendingLogs = await Promise.all(
      toProcess.map((group) =>
        this.prisma.messageLog.create({
          data: {
            tenantId,
            scheduleId,
            groupId: group.id,
            waGroupId: group.waGroupId,
            status: 'pending',
            message: schedule.message,
            imageUrls: schedule.imageUrls,
            scheduledAt,
          },
        }),
      ),
    );

    await Promise.all(
      overCap.map((group) =>
        this.prisma.messageLog.create({
          data: {
            tenantId,
            scheduleId,
            groupId: group.id,
            waGroupId: group.waGroupId,
            status: 'failed',
            errorReason: 'daily_cap_exceeded',
            message: schedule.message,
            imageUrls: schedule.imageUrls,
            scheduledAt,
          },
        }),
      ),
    );

    for (const log of pendingLogs) {
      await this.sendWithRetry(log, tenantId);
    }
  }

  private async sendWithRetry(log: any, tenantId: string): Promise<void> {
    const lockKey = `wa:lock:tenant:${tenantId}`;
    const lockValue = `${log.id}:${Date.now()}`;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      const acquired = await redis.set(lockKey, lockValue, 'EX', 30, 'NX');
      if (!acquired) {
        if (attempt === maxRetries) {
          await this.prisma.messageLog.update({
            where: { id: log.id },
            data: { status: 'failed', errorReason: 'lock_timeout' },
          });
          return;
        }
        await sleep(5000 * Math.pow(2, attempt - 1));
        continue;
      }

      try {
        const sock = this.whatsapp.getSocket(tenantId);
        if (!sock) {
          throw new Error('WhatsApp not connected');
        }

        await sleep(jitteredDelay());

        let whatsappMessageId: string | undefined;
        if (log.imageUrls?.length) {
          const [firstUrl, ...rest] = log.imageUrls;
          const sent = await sock.sendMessage(log.waGroupId, {
            image: { url: firstUrl },
            caption: log.message,
          });
          whatsappMessageId = sent.key?.id;

          for (const url of rest) {
            await sleep(jitteredDelay());
            await sock.sendMessage(log.waGroupId, { image: { url } });
          }
        } else {
          const sent = await sock.sendMessage(log.waGroupId, { text: log.message });
          whatsappMessageId = sent.key?.id;
        }

        await this.prisma.messageLog.update({
          where: { id: log.id },
          data: {
            status: 'sent',
            whatsappMessageId,
            sentAt: new Date(),
          },
        });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Send attempt ${attempt} failed for log ${log.id}: ${message}`);

        if (attempt === maxRetries) {
          await this.prisma.messageLog.update({
            where: { id: log.id },
            data: { status: 'failed', errorReason: message },
          });
          return;
        }

        await sleep(5000 * Math.pow(2, attempt - 1));
      } finally {
        const currentLockValue = await redis.get(lockKey);
        if (currentLockValue === lockValue) {
          await redis.del(lockKey);
        }
      }
    }
  }
}
