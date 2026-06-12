import { Injectable, UnauthorizedException } from "@nestjs/common";
import {
  AuthenticationCreds,
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  proto,
  SignalDataTypeMap
} from "baileys";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "../common/crypto.service";

/**
 * Per-key Baileys auth-state adapter backed by Prisma + AES-GCM encryption.
 *
 * Two storage tables:
 *   - WhatsAppSession.encryptedCreds : the small AuthenticationCreds blob
 *   - WhatsAppAuthKey                : signal store, one row per (category, keyId)
 *
 * BufferJSON.replacer/reviver is used to serialize Buffers/proto values that
 * Baileys puts inside creds.
 */
@Injectable()
export class BaileysAuthAdapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService
  ) {}

  async build(tenantId: string): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
  }> {
    let creds = await this.loadCreds(tenantId);
    if (!creds) {
      creds = initAuthCreds();
      await this.persistCreds(tenantId, creds);
    }

    const adapter = this;

    const state: AuthenticationState = {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[]
        ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
          const rows = await adapter.prisma.whatsAppAuthKey.findMany({
            where: { tenantId, category: type as string, keyId: { in: ids } }
          });
          const out: { [id: string]: SignalDataTypeMap[T] } = {};
          for (const row of rows) {
            const json = adapter.crypto.decryptString(row.encryptedValue);
            let value: any = JSON.parse(json, BufferJSON.reviver);
            if (type === "app-state-sync-key" && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            out[row.keyId] = value;
          }
          return out;
        },
        set: async (data) => {
          const ops: Promise<any>[] = [];
          for (const category of Object.keys(data) as Array<
            keyof SignalDataTypeMap
          >) {
            const cat = data[category];
            if (!cat) continue;
            for (const keyId of Object.keys(cat)) {
              const value = (cat as any)[keyId];
              if (value === null || value === undefined) {
                ops.push(
                  adapter.prisma.whatsAppAuthKey.deleteMany({
                    where: { tenantId, category: category as string, keyId }
                  })
                );
              } else {
                const json = JSON.stringify(value, BufferJSON.replacer);
                const enc = adapter.crypto.encrypt(json);
                ops.push(
                  adapter.prisma.whatsAppAuthKey.upsert({
                    where: {
                      tenantId_category_keyId: {
                        tenantId,
                        category: category as string,
                        keyId
                      }
                    },
                    create: {
                      tenantId,
                      category: category as string,
                      keyId,
                      encryptedValue: enc
                    },
                    update: { encryptedValue: enc }
                  })
                );
              }
            }
          }
          await Promise.all(ops);
        }
      }
    };

    return {
      state,
      saveCreds: async () => adapter.persistCreds(tenantId, state.creds)
    };
  }

  async wipe(tenantId: string) {
    await this.prisma.$transaction([
      this.prisma.whatsAppAuthKey.deleteMany({ where: { tenantId } }),
      this.prisma.whatsAppSession.updateMany({
        where: { tenantId },
        data: { encryptedCreds: null, connectionStatus: "disconnected" }
      })
    ]);
  }

  private async loadCreds(
    tenantId: string
  ): Promise<AuthenticationCreds | null> {
    const row = await this.prisma.whatsAppSession.findUnique({
      where: { tenantId }
    });
    if (!row?.encryptedCreds) return null;
    const json = this.crypto.decryptString(row.encryptedCreds);
    return JSON.parse(json, BufferJSON.reviver) as AuthenticationCreds;
  }

  private async persistCreds(tenantId: string, creds: AuthenticationCreds) {
    const json = JSON.stringify(creds, BufferJSON.replacer);
    const enc = this.crypto.encrypt(json);
    try {
      await this.prisma.whatsAppSession.upsert({
        where: { tenantId },
        create: {
          tenantId,
          encryptedCreds: enc,
          connectionStatus: "disconnected"
        },
        update: { encryptedCreds: enc }
      });
    } catch (e: any) {
      if (e?.code === "P2003") {
        throw new UnauthorizedException("Invalid or stale tenant context");
      }
      throw e;
    }
  }
}
