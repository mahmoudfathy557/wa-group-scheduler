import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef
} from "@nestjs/common";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  GroupMetadata,
  WASocket
} from "baileys";
import * as QRCode from "qrcode";
import { PrismaService } from "../prisma/prisma.service";
import { BaileysAuthAdapter } from "./baileys-auth.adapter";
import { WhatsAppGateway } from "../socket/whatsapp.gateway";

interface TenantSocketEntry {
  sock: WASocket;
  status: "connecting" | "connected" | "disconnected";
  reconnectAttempts: number;
}

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly sockets = new Map<string, TenantSocketEntry>();
  private readonly latestQrs = new Map<string, string>();
  private destroyed = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authAdapter: BaileysAuthAdapter,
    @Inject(forwardRef(() => WhatsAppGateway))
    private readonly gateway: WhatsAppGateway
  ) {}

  async onModuleInit() {
    // Reconnect every tenant that has saved creds.
    const sessions = await this.prisma.whatsAppSession.findMany({
      where: { encryptedCreds: { not: null } }
    });
    this.logger.log(`Reconnecting ${sessions.length} saved WhatsApp sessions`);
    for (const s of sessions) {
      this.connect(s.tenantId).catch((e) =>
        this.logger.error(
          `Bootstrap connect failed for ${s.tenantId}: ${e?.message}`
        )
      );
    }
  }

  async onModuleDestroy() {
    this.destroyed = true;
    for (const [tenantId, entry] of this.sockets) {
      try {
        entry.sock.end(undefined as any);
      } catch (e: any) {
        this.logger.warn(`Error closing socket for ${tenantId}: ${e?.message}`);
      }
    }
    this.sockets.clear();
  }

  getSocket(tenantId: string): WASocket | null {
    const entry = this.sockets.get(tenantId);
    if (!entry || entry.status !== "connected") return null;
    return entry.sock;
  }

  getStatus(tenantId: string): "connecting" | "connected" | "disconnected" {
    return this.sockets.get(tenantId)?.status ?? "disconnected";
  }

  getLatestQr(tenantId: string): string | null {
    return this.latestQrs.get(tenantId) ?? null;
  }

  async connect(tenantId: string): Promise<void> {
    if (this.sockets.has(tenantId)) {
      const existing = this.sockets.get(tenantId)!;
      if (existing.status === "connected" || existing.status === "connecting") {
        return;
      }
    }

    const { state, saveCreds } = await this.authAdapter.build(tenantId);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.macOS("Chrome"),
      syncFullHistory: false
    });

    const entry: TenantSocketEntry = {
      sock,
      status: "connecting",
      reconnectAttempts: 0
    };
    this.sockets.set(tenantId, entry);
    await this.updateStatus(tenantId, "connecting");

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const dataUrl = await QRCode.toDataURL(qr);
          this.latestQrs.set(tenantId, dataUrl);
          this.gateway.emitToTenant(tenantId, "whatsapp:qr", { qr: dataUrl });
        } catch (e: any) {
          this.logger.error(`QR encode failed for ${tenantId}: ${e?.message}`);
        }
      }

      if (connection === "open") {
        this.latestQrs.delete(tenantId);
        entry.status = "connected";
        entry.reconnectAttempts = 0;
        await this.updateStatus(tenantId, "connected");
        this.gateway.emitToTenant(tenantId, "whatsapp:status", {
          status: "connected"
        });
        this.logger.log(`Tenant ${tenantId} WhatsApp connected`);
      } else if (connection === "close") {
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = code === DisconnectReason.loggedOut;
        entry.status = "disconnected";
        await this.updateStatus(tenantId, "disconnected");
        this.gateway.emitToTenant(tenantId, "whatsapp:status", {
          status: "disconnected",
          reason: isLoggedOut ? "logged_out" : "connection_lost"
        });

        if (isLoggedOut) {
          this.logger.warn(`Tenant ${tenantId} logged out — wiping creds`);
          await this.authAdapter.wipe(tenantId);
          this.sockets.delete(tenantId);
          return;
        }

        if (this.destroyed) return;
        const attempts = ++entry.reconnectAttempts;
        const delay = Math.min(
          60_000,
          1000 * Math.pow(2, Math.min(attempts, 6))
        );
        this.logger.warn(
          `Tenant ${tenantId} disconnected (code=${code}); retrying in ${delay}ms (attempt ${attempts})`
        );
        setTimeout(() => {
          this.sockets.delete(tenantId);
          this.connect(tenantId).catch((e) =>
            this.logger.error(`Reconnect failed for ${tenantId}: ${e?.message}`)
          );
        }, delay);
      }
    });
  }

  async disconnect(tenantId: string): Promise<void> {
    const entry = this.sockets.get(tenantId);
    if (entry) {
      try {
        await entry.sock.logout();
      } catch {
        /* ignore */
      }
      try {
        entry.sock.end(undefined as any);
      } catch {
        /* ignore */
      }
    }
    this.sockets.delete(tenantId);
    this.latestQrs.delete(tenantId);
    await this.authAdapter.wipe(tenantId);
    this.gateway.emitToTenant(tenantId, "whatsapp:status", {
      status: "disconnected"
    });
  }

  async listGroups(tenantId: string): Promise<GroupMetadata[]> {
    const sock = this.getSocket(tenantId);
    if (!sock) throw new Error("WhatsApp not connected");
    const map = await sock.groupFetchAllParticipating();
    return Object.values(map);
  }

  async sendText(
    tenantId: string,
    jid: string,
    text: string,
    imageUrls: string[] = []
  ): Promise<string | null> {
    const sock = this.getSocket(tenantId);
    if (!sock) throw new Error("WhatsApp not connected");

    if (!imageUrls.length) {
      const res = await sock.sendMessage(jid, { text });
      return res?.key?.id ?? null;
    }

    let firstId: string | null = null;
    for (let i = 0; i < imageUrls.length; i++) {
      const res = await sock.sendMessage(jid, {
        image: { url: imageUrls[i] },
        caption: i === 0 ? text : undefined
      });
      if (!firstId) firstId = res?.key?.id ?? null;
    }

    return firstId;
  }

  private async updateStatus(tenantId: string, status: string) {
    await this.prisma.whatsAppSession.upsert({
      where: { tenantId },
      create: { tenantId, connectionStatus: status },
      update: { connectionStatus: status, lastActive: new Date() }
    });
  }
}
