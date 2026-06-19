import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import Redis from "ioredis";
import { randomUUID } from "crypto";
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
  imageUrls: string[];
  logId: string;
  index: number;
}

const LOCK_TTL_MS = 30_000;
const RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 5000;

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
  private readonly lockAcquireTimeoutMs: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryMaxDelayMs: number;
  private readonly dailyCapRetryDelayMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wa: WhatsAppService,
    private readonly gateway: WhatsAppGateway,
    @InjectQueue(MESSAGE_SEND_QUEUE)
    private readonly sendQueue: Queue<SendJobData>
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
    this.lockAcquireTimeoutMs = parseInt(
      process.env.TENANT_LOCK_ACQUIRE_TIMEOUT_MS || "180000",
      10
    );
    this.retryBaseDelayMs = parseInt(
      process.env.MESSAGE_RETRY_BASE_DELAY_MS || "30000",
      10
    );
    this.retryMaxDelayMs = parseInt(
      process.env.MESSAGE_RETRY_MAX_DELAY_MS || "900000",
      10
    );
    this.dailyCapRetryDelayMs = parseInt(
      process.env.DAILY_CAP_RETRY_DELAY_MS || "600000",
      10
    );
  }

  async process(job: Job<SendJobData>): Promise<void> {
    const data = job.data;

    // Skip duplicate/replayed jobs if already finalized.
    const log = await this.prisma.messageLog.findUnique({
      where: { id: data.logId },
      select: { status: true }
    });
    if (!log || log.status === "sent") {
      return;
    }

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
      await this.reschedulePending(
        data,
        "daily_cap_wait",
        this.dailyCapRetryDelayMs
      );
      return;
    }

    // -- Per-tenant serialization + anti-ban jitter
    const lockKey = `wa:lock:tenant:${data.tenantId}`;
    const lockToken = await this.acquireLock(
      lockKey,
      this.lockAcquireTimeoutMs
    );
    if (!lockToken) {
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.reschedulePending(
          data,
          "tenant_lock_busy",
          this.computeRetryDelay(job.attemptsMade + 1)
        );
        return;
      }

      // Another job for this tenant is in flight; let BullMQ retry with backoff.
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
          data.messageText,
          data.imageUrls
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
        // Last in-job attempt? Requeue with delay instead of terminal failure.
        if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
          await this.reschedulePending(
            data,
            reason,
            this.computeRetryDelay(job.attemptsMade + 1)
          );
          return;
        }
        throw e;
      }
    } finally {
      await this.releaseLock(lockKey, lockToken);
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

  private async reschedulePending(
    data: SendJobData,
    reason: string,
    delayMs: number
  ) {
    await this.prisma.messageLog.update({
      where: { id: data.logId },
      data: { status: "pending", errorReason: reason }
    });

    await this.sendQueue.add("send", data, {
      // Unique retry job id prevents collision with active/completed job ids.
      jobId: `${data.logId}:retry:${Date.now()}:${Math.floor(Math.random() * 1000)}`,
      delay: Math.max(delayMs, 1000),
      attempts: RETRY_ATTEMPTS,
      backoff: { type: "exponential", delay: RETRY_BACKOFF_MS },
      removeOnComplete: true,
      removeOnFail: true
    });

    this.gateway.emitToTenant(data.tenantId, "log:updated", {
      id: data.logId,
      status: "pending",
      scheduleId: data.scheduleId,
      groupJid: data.groupJid,
      errorReason: reason,
      retryInMs: Math.max(delayMs, 1000)
    });
  }

  private computeRetryDelay(attemptNumber: number): number {
    const exp = Math.min(
      this.retryBaseDelayMs * Math.pow(2, Math.max(attemptNumber - 1, 0)),
      this.retryMaxDelayMs
    );
    return Math.floor(exp * (0.9 + Math.random() * 0.2));
  }

  private async acquireLock(
    key: string,
    timeoutMs: number
  ): Promise<string | null> {
    // Wait up to a bounded timeout so fan-out jobs (many groups) can serialize
    // under one tenant lock without dropping later jobs.
    const deadline = Date.now() + Math.max(timeoutMs, 0);
    const token = randomUUID();
    while (Date.now() < deadline) {
      const res = await this.redis.set(key, token, "PX", LOCK_TTL_MS, "NX");
      if (res === "OK") return token;
      await sleep(200 + Math.random() * 200);
    }
    return null;
  }

  private async releaseLock(key: string, token: string) {
    try {
      // Release only if we still own the lock token.
      await this.redis.eval(
        `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
        1,
        key,
        token
      );
    } catch {
      /* ignore */
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
