import { Injectable } from "@nestjs/common";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";

@Injectable()
export class LogsService {
  constructor(private readonly tprisma: TenantPrismaService) {}

  async list(query: {
    scheduleId?: string;
    status?: string;
    take?: number;
    skip?: number;
  }) {
    const client: any = this.tprisma.client;
    const viewState = await client.logViewState.findFirst();

    const where: any = {};
    if (query.scheduleId) where.scheduleId = query.scheduleId;
    if (query.status) where.status = query.status;
    if (viewState?.logsClearedAt) {
      where.createdAt = { gt: viewState.logsClearedAt };
    }

    return client.messageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(query.take ?? 50, 200),
      skip: query.skip ?? 0
    });
  }

  async clearView() {
    const client: any = this.tprisma.client;
    const logsClearedAt = new Date();

    const updated = await client.logViewState.updateMany({
      where: {},
      data: { logsClearedAt }
    });

    if (updated.count === 0) {
      await client.logViewState.create({
        data: { logsClearedAt }
      });
    }

    return { logsClearedAt };
  }

  async stats() {
    const client: any = this.tprisma.client;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const stalePendingCutoff = new Date(Date.now() - 2 * 60 * 1000);
    const retryPendingCutoff = new Date(Date.now() - 10 * 60 * 1000);
    const [sent, failed, pending, sentToday] = await Promise.all([
      client.messageLog.count({ where: { status: "sent" } }),
      client.messageLog.count({ where: { status: "failed" } }),
      client.messageLog.count({ where: { status: "pending" } }),
      client.messageLog.count({
        where: { status: "sent", createdAt: { gte: today } }
      })
    ]);

    const [stalePending, longPending, pendingAwaitingEnqueue] =
      await Promise.all([
        client.messageLog.count({
          where: {
            status: "pending",
            createdAt: { lte: stalePendingCutoff }
          }
        }),
        client.messageLog.count({
          where: {
            status: "pending",
            createdAt: { lte: retryPendingCutoff }
          }
        }),
        client.messageLog.count({
          where: {
            status: "pending",
            errorReason: "enqueue_pending_retry"
          }
        })
      ]);

    return {
      sent,
      failed,
      pending,
      sentToday,
      stalePending,
      longPending,
      pendingAwaitingEnqueue
    };
  }
}
