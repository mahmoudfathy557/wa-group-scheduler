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

  it("logs warning/error when sendQueue.add fails for stale logs", async () => {
    const staleLog1 = {
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

    const staleLog2 = {
      id: "log-2",
      tenantId: "tenant-1",
      scheduleId: "schedule-1",
      runId: "run-2",
      groupJid: "group-2@g.us",
      createdAt: new Date(Date.now() - 6 * 60 * 1000),
      schedule: {
        messageText: "world",
        imageUrls: []
      }
    };

    const prisma = {
      messageLog: {
        findMany: jest.fn().mockResolvedValue([staleLog1, staleLog2])
      }
    } as any;

    const sendQueue = {
      add: jest.fn().mockRejectedValue(new Error("Queue service unavailable"))
    } as any;

    // Create service with mocked dependencies
    const { PendingReconcileService } =
      await import("./pending-reconcile.service");
    const svc = new PendingReconcileService(prisma, sendQueue);

    // Should not crash, should attempt to log failures with context
    await svc.reconcilePendingLogs();

    expect(sendQueue.add).toHaveBeenCalledTimes(2);
  });
});
