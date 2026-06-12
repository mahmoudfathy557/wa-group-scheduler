import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Raw, un-scoped PrismaClient. Use this only in:
 *   - auth flows (register/login) where there is no tenant yet
 *   - the Baileys auth-state adapter (which scopes by tenantId itself)
 *   - the BullMQ workers (which receive tenantId in the job payload)
 *
 * Everywhere else, inject TenantPrismaService.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
