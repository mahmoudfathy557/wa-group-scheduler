import { Injectable } from "@nestjs/common";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { ISendGateway, SendParams } from "./send-gateway.interface";

@Injectable()
export class WaSendGateway implements ISendGateway {
  private readonly minDelay: number;
  private readonly maxDelay: number;

  constructor(private readonly wa: WhatsAppService) {
    this.minDelay = parseInt(process.env.MESSAGE_DELAY_MIN_MS || "5000", 10);
    this.maxDelay = parseInt(process.env.MESSAGE_DELAY_MAX_MS || "60000", 10);
  }

  isConnected(tenantId: string): boolean {
    return this.wa.getStatus(tenantId) === "connected";
  }

  async sendWithJitter(params: SendParams): Promise<string | null> {
    const { tenantId, groupJid, messageText, imageUrls, index } = params;

    // Skip jitter for the first message of a fan-out to keep it snappy.
    if (index > 0) {
      const delay = this.gaussianDelay(this.minDelay, this.maxDelay);
      await sleep(delay);
    }

    return this.wa.sendText(tenantId, groupJid, messageText, imageUrls);
  }

  private gaussianDelay(min: number, max: number): number {
    if (max <= min) return min;

    const mean = (min + max) / 2;
    // 99.7% of values are inside [mean - 3sigma, mean + 3sigma]
    const sigma = (max - min) / 6;

    // Box-Muller transform for standard normal sample.
    const u1 = Math.max(Math.random(), Number.EPSILON);
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    const sample = mean + z0 * sigma;
    return Math.round(Math.min(max, Math.max(min, sample)));
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
