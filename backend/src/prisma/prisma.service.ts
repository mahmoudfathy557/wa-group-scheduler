import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const TENANT_MODELS = new Set(['WhatsAppSession', 'WhatsAppAuthKey', 'Group', 'Schedule', 'MessageLog']);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  forTenant(tenantId: string) {
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const normalizedArgs = (args ?? {}) as Record<string, any>;

            if (model && TENANT_MODELS.has(model)) {
              if (normalizedArgs.where !== undefined || ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy', 'delete', 'deleteMany', 'update', 'updateMany', 'upsert'].includes(operation)) {
                normalizedArgs.where = { ...(normalizedArgs.where ?? {}), tenantId };
              }

              if (normalizedArgs.data !== undefined) {
                normalizedArgs.data = Array.isArray(normalizedArgs.data)
                  ? normalizedArgs.data.map((item) => ({ ...item, tenantId }))
                  : { ...normalizedArgs.data, tenantId };
              }

              if (normalizedArgs.create !== undefined) {
                normalizedArgs.create = { ...normalizedArgs.create, tenantId };
              }
            }

            return query(normalizedArgs);
          },
        },
      },
    });
  }
}
