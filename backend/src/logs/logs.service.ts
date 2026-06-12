import { Injectable } from "@nestjs/common";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";

@Injectable()
export class LogsService {
  constructor(private readonly tprisma: TenantPrismaService) {}

  list(query: {
    scheduleId?: string;
    status?: string;
    take?: number;
    skip?: number;
  }) {
    const where: any = {};
    if (query.scheduleId) where.scheduleId = query.scheduleId;
    if (query.status) where.status = query.status;
    return (this.tprisma.client as any).messageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(query.take ?? 50, 200),
      skip: query.skip ?? 0
    });
  }

  async stats() {
    const client: any = this.tprisma.client;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [sent, failed, pending, sentToday] = await Promise.all([
      client.messageLog.count({ where: { status: "sent" } }),
      client.messageLog.count({ where: { status: "failed" } }),
      client.messageLog.count({ where: { status: "pending" } }),
      client.messageLog.count({
        where: { status: "sent", createdAt: { gte: today } }
      })
    ]);
    return { sent, failed, pending, sentToday };
  }
}
