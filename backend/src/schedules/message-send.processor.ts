import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import Redis from "ioredis";
import { startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { WhatsAppGateway } from "../socket/whatsapp.gateway";
import { MESSAGE_SEND_QUEUE } from "./queue.constants";

interface SendJobData {
  tenantId: string;
  scheduleId: string;
  runId: string;
  groupJid: string;
  messageText: string;
  logId: string;
  index: number;
}

const LOCK_TTL_MS = 30_000;

/**
 * Worker for `message-send` queue. Responsibilities per job:
 *   1. Daily-cap check (count today's pending+sent in tenant timezone).
 *   2. Per-tenant Redis lock (SET NX PX) → randomized 5–10s delay between sends
 *      → release. Serializes sends within a tenant; jitters between tenants.
 *   3. Call Baileys sendMessage.
 *   4. Update MessageLog status.
 *   5. Emit log update to tenant socket room.
 */
@Processor(MESSAGE_SEND_QUEUE, { concurrency: 8 })
export class MessageSendProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageSendProcessor.name);
  private readonly redis: Redis;
  private readonly minDelay: number;
  private readonly maxDelay: number;
  private readonly dailyCap: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wa: WhatsAppService,
    private readonly gateway: WhatsAppGateway
  ) {
    super();
    this.redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null
    });
    this.minDelay = parseInt(process.env.MESSAGE_DELAY_MIN_MS || "5000", 10);
    this.maxDelay = parseInt(process.env.MESSAGE_DELAY_MAX_MS || "10000", 10);
    this.dailyCap = parseInt(
      process.env.DAILY_MESSAGE_CAP_PER_TENANT || "100",
      10
    );
  }

  async process(job: Job<SendJobData>): Promise<void> {
    const data = job.data;

    // -- Daily cap check (tenant-local "today")
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: data.tenantId }
    });
    const tz = tenant?.timezone || "UTC";
    const nowZoned = toZonedTime(new Date(), tz);
    const startZoned = startOfDay(nowZoned);
    const startUtc = fromZonedTime(startZoned, tz);

    const todayCount = await this.prisma.messageLog.count({
      where: {
        tenantId: data.tenantId,
        createdAt: { gte: startUtc },
        status: { in: ["sent", "pending"] }
      }
    });

    if (todayCount > this.dailyCap) {
      await this.markFailed(data, "daily_cap_exceeded");
      // Do NOT throw — we don't want BullMQ to retry past the cap.
      return;
    }

    // -- Per-tenant serialization + anti-ban jitter
    const lockKey = `wa:lock:tenant:${data.tenantId}`;
    const acquired = await this.acquireLock(lockKey);
    if (!acquired) {
      // Another job for this tenant is in flight; throwing triggers retry with backoff.
      throw new Error("tenant_lock_busy");
    }

    try {
      // Skip jitter for the first send of a fan-out (index 0) to give snappy first message.
      if (data.index > 0) {
        const jitter =
          this.minDelay + Math.random() * (this.maxDelay - this.minDelay);
        await sleep(jitter);
      }

      try {
        const waMessageId = await this.wa.sendText(
          data.tenantId,
          data.groupJid,
          data.messageText
        );
        await this.prisma.messageLog.update({
          where: { id: data.logId },
          data: { status: "sent", whatsappMessageId: waMessageId ?? null }
        });
        this.gateway.emitToTenant(data.tenantId, "log:updated", {
          id: data.logId,
          status: "sent",
          scheduleId: data.scheduleId,
          groupJid: data.groupJid
        });
      } catch (e: any) {
        const reason = e?.message || "send_failed";
        // Last attempt? Let BullMQ retry — it will re-enter this worker until attempts exhausted.
        if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
          await this.markFailed(data, reason);
          return;
        }
        throw e;
      }
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  private async markFailed(data: SendJobData, reason: string) {
    await this.prisma.messageLog.update({
      where: { id: data.logId },
      data: { status: "failed", errorReason: reason }
    });
    this.gateway.emitToTenant(data.tenantId, "log:updated", {
      id: data.logId,
      status: "failed",
      scheduleId: data.scheduleId,
      groupJid: data.groupJid,
      errorReason: reason
    });
  }

  private async acquireLock(key: string): Promise<boolean> {
    // Best-effort spin: try a few times across ~1s before giving up.
    for (let i = 0; i < 5; i++) {
      const res = await this.redis.set(key, "1", "PX", LOCK_TTL_MS, "NX");
      if (res === "OK") return true;
      await sleep(200 + Math.random() * 200);
    }
    return false;
  }

  private async releaseLock(key: string) {
    try {
      await this.redis.del(key);
    } catch {
      /* ignore */
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
