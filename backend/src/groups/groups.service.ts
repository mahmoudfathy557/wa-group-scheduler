import { Injectable } from "@nestjs/common";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";

@Injectable()
export class GroupsService {
  constructor(
    private readonly tprisma: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly wa: WhatsAppService
  ) {}

  list() {
    return (this.tprisma.client as any).group.findMany({
      orderBy: { name: "asc" }
    });
  }

  /**
   * Pull groups from the live WhatsApp socket and upsert them.
   * Uses raw PrismaService for the upsert so the compound unique key
   * (tenantId_groupJid) is not rewritten by the tenant extension.
   */
  async sync(tenantId: string) {
    const groups = await this.wa.listGroups(tenantId);
    for (const g of groups) {
      await this.prisma.group.upsert({
        where: { tenantId_groupJid: { tenantId, groupJid: g.id } },
        create: {
          tenantId,
          groupJid: g.id,
          name: g.subject || g.id,
          participantCount: g.participants?.length ?? null
        },
        update: {
          name: g.subject || g.id,
          participantCount: g.participants?.length ?? null,
          lastSynced: new Date()
        }
      });
    }
    return this.list();
  }
}
