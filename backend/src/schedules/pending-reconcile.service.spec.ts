describe("PendingReconcileService", () => {
  it("requeues stale pending logs", async () => {
    const { PendingReconcileService } =
      await import("./pending-reconcile.service");

    const staleLog = {
      id: "log-1",
      tenantId: "tenant-1",
      scheduleId: "schedule-1",
      runId: "run-1",
      groupJid: "group-1@g.us",
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
      schedule: {
        messageText: "hello",
        imageUrls: []
      }
    };

    const prisma = {
      messageLog: {
        findMany: jest.fn().mockResolvedValue([staleLog])
      }
    } as any;

    const sendQueue = {
      add: jest.fn().mockResolvedValue(undefined)
    } as any;

    const svc = new PendingReconcileService(prisma, sendQueue);
    await svc.reconcilePendingLogs();

    expect(prisma.messageLog.findMany).toHaveBeenCalled();
    expect(sendQueue.add).toHaveBeenCalledTimes(1);
    expect(sendQueue.add).toHaveBeenCalledWith(
      "send",
      expect.objectContaining({
        logId: "log-1",
        tenantId: "tenant-1",
        scheduleId: "schedule-1"
      }),
      expect.objectContaining({
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: true
      })
    );
  });

  it("skips logs already marked as stale pending requeued", async () => {
    const { PendingReconcileService } =
      await import("./pending-reconcile.service");

    const prisma = {
      messageLog: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn()
      }
    } as any;

    const sendQueue = {
      add: jest.fn().mockResolvedValue(undefined)
    } as any;

    const svc = new PendingReconcileService(prisma, sendQueue);
    await svc.reconcilePendingLogs();

    expect(prisma.messageLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: { errorReason: "stale_pending_requeued" }
        })
      })
    );
    expect(prisma.messageLog.update).not.toHaveBeenCalled();
    expect(sendQueue.add).not.toHaveBeenCalled();
  });
});
