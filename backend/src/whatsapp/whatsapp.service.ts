import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Boom } from '@hapi/boom';
import {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeWASocket,
  WASocket,
} from 'baileys';
import pino from 'pino';
import { EncryptionService } from '../encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppGateway } from './whatsapp.gateway';

const activeSockets = new Map<string, WASocket>();

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly baileysLogger = pino({ level: 'silent' });

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly gateway: WhatsAppGateway,
  ) {}

  async onModuleInit() {
    const sessions = await this.prisma.whatsAppSession.findMany({
      where: { encryptedCreds: { not: null } },
    });

    for (const session of sessions) {
      this.logger.log(`Rehydrating session for tenant ${session.tenantId}`);
      try {
        await this.connect(session.tenantId, false);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to rehydrate session for ${session.tenantId}: ${message}`);
      }
    }
  }

  private emitStatus(tenantId: string, status: string, data?: Record<string, any>) {
    this.gateway.emitToTenant(tenantId, 'whatsapp.status', { status, ...data });
  }

  private closeSocket(tenantId: string) {
    const sock = activeSockets.get(tenantId) as any;
    try {
      sock?.end?.(undefined);
    } catch {
      // ignore
    }
    activeSockets.delete(tenantId);
  }

  async connect(tenantId: string, startFresh = false): Promise<void> {
    this.closeSocket(tenantId);

    if (startFresh) {
      await this.prisma.whatsAppAuthKey.deleteMany({ where: { tenantId } });
      await this.prisma.whatsAppSession.upsert({
        where: { tenantId },
        update: { encryptedCreds: null, status: 'connecting' },
        create: { tenantId, status: 'connecting' },
      });
    }

    const authState = await this.buildAuthState(tenantId);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: {
        creds: authState.creds,
        keys: makeCacheableSignalKeyStore(authState.keys as any, this.baileysLogger),
      },
      printQRInTerminal: false,
      logger: this.baileysLogger,
      browser: ['WA-Scheduler', 'Chrome', '1.0'],
    });

    activeSockets.set(tenantId, sock);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.emitStatus(tenantId, 'qr', { qr });
      }

      if (connection === 'connecting') {
        await this.prisma.whatsAppSession.upsert({
          where: { tenantId },
          update: { status: 'connecting' },
          create: { tenantId, status: 'connecting' },
        });
        this.emitStatus(tenantId, 'connecting');
      }

      if (connection === 'open') {
        authState.creds = sock.authState.creds;
        await authState.saveCreds();
        await this.prisma.whatsAppSession.update({
          where: { tenantId },
          data: { status: 'connected' },
        });
        this.emitStatus(tenantId, 'connected');
        this.logger.log(`Tenant ${tenantId} connected`);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        this.logger.log(
          `Tenant ${tenantId} disconnected, statusCode=${statusCode}, shouldReconnect=${shouldReconnect}`,
        );

        if (shouldReconnect) {
          await this.prisma.whatsAppSession.upsert({
            where: { tenantId },
            update: { status: 'connecting' },
            create: { tenantId, status: 'connecting' },
          });
          this.emitStatus(tenantId, 'connecting');
          setTimeout(() => {
            void this.connect(tenantId, false);
          }, 3000);
        } else {
          await this.clearSession(tenantId);
          this.emitStatus(tenantId, 'disconnected', { reason: 'logged_out' });
        }
      }
    });

    sock.ev.on('creds.update', async () => {
      authState.creds = sock.authState.creds;
      await authState.saveCreds();
    });
  }

  async disconnect(tenantId: string): Promise<void> {
    const sock = activeSockets.get(tenantId);
    if (sock) {
      try {
        await sock.logout();
      } catch {
        // ignore
      }
    }

    this.closeSocket(tenantId);
    await this.clearSession(tenantId);
    this.emitStatus(tenantId, 'disconnected');
  }

  private async clearSession(tenantId: string): Promise<void> {
    activeSockets.delete(tenantId);
    await this.prisma.whatsAppSession.upsert({
      where: { tenantId },
      update: { status: 'disconnected', encryptedCreds: null },
      create: { tenantId, status: 'disconnected', encryptedCreds: null },
    });
    await this.prisma.whatsAppAuthKey.deleteMany({ where: { tenantId } });
  }

  async getStatus(tenantId: string): Promise<{ status: string }> {
    const session = await this.prisma.whatsAppSession.findUnique({ where: { tenantId } });
    return { status: session?.status || 'disconnected' };
  }

  async syncGroups(tenantId: string) {
    const sock = activeSockets.get(tenantId);
    if (!sock) {
      throw new Error('WhatsApp not connected');
    }

    const groups = await sock.groupFetchAllParticipating();
    const groupArray = Object.values(groups);

    for (const group of groupArray) {
      await this.prisma.group.upsert({
        where: { tenantId_waGroupId: { tenantId, waGroupId: group.id } },
        update: {
          name: group.subject,
          description: group.desc || null,
          syncedAt: new Date(),
        },
        create: {
          tenantId,
          waGroupId: group.id,
          name: group.subject,
          description: group.desc || null,
        },
      });
    }

    return this.prisma.group.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  getSocket(tenantId: string): WASocket | undefined {
    return activeSockets.get(tenantId);
  }

  private async buildAuthState(tenantId: string) {
    const baileys = await import('baileys');
    const { initAuthCreds, BufferJSON } = baileys;

    const session = await this.prisma.whatsAppSession.findUnique({ where: { tenantId } });

    let creds = initAuthCreds();
    if (session?.encryptedCreds) {
      try {
        const decrypted = this.encryption.decrypt(Buffer.from(session.encryptedCreds));
        creds = JSON.parse(decrypted.toString('utf8'), BufferJSON.reviver);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to decrypt creds for ${tenantId}: ${message}`);
      }
    }

    const saveCreds = async () => {
      const encrypted = this.encryption.encrypt(
        Buffer.from(JSON.stringify(creds, BufferJSON.replacer), 'utf8'),
      );
      await this.prisma.whatsAppSession.upsert({
        where: { tenantId },
        update: { encryptedCreds: encrypted },
        create: { tenantId, encryptedCreds: encrypted, status: 'connecting' },
      });
    };

    const keys = {
      get: async (type: string, ids: string[]) => {
        const rows = await this.prisma.whatsAppAuthKey.findMany({
          where: { tenantId, keyType: type, keyId: { in: ids } },
        });
        const result: Record<string, any> = {};
        for (const row of rows) {
          try {
            const decrypted = this.encryption.decrypt(Buffer.from(row.encryptedData));
            result[row.keyId] = JSON.parse(decrypted.toString('utf8'), BufferJSON.reviver);
          } catch {
            // ignore malformed key rows
          }
        }
        return result;
      },
      set: async (data: Record<string, Record<string, any>>) => {
        for (const [type, entries] of Object.entries(data)) {
          for (const [id, value] of Object.entries(entries)) {
            if (value == null) {
              await this.prisma.whatsAppAuthKey.deleteMany({
                where: { tenantId, keyType: type, keyId: id },
              });
              continue;
            }

            const encrypted = this.encryption.encrypt(
              Buffer.from(JSON.stringify(value, BufferJSON.replacer), 'utf8'),
            );
            await this.prisma.whatsAppAuthKey.upsert({
              where: { tenantId_keyType_keyId: { tenantId, keyType: type, keyId: id } },
              update: { encryptedData: encrypted },
              create: { tenantId, keyType: type, keyId: id, encryptedData: encrypted },
            });
          }
        }
      },
    };

    return { creds, keys, saveCreds };
  }
}
