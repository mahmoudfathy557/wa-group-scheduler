describe("RunCompletenessService", () => {
  it("repairs missing group logs for a recent run and enqueues send jobs", async () => {
    const { RunCompletenessService } =
      await import("./run-completeness.service");

    const prisma = {
      messageLog: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              tenantId: "tenant-1",
              scheduleId: "schedule-1",
              runId: "run-1"
            }
          ])
          .mockResolvedValueOnce([
            { groupJid: "group-1@g.us" },
            { groupJid: "group-2@g.us" }
          ]),
        create: jest.fn().mockResolvedValue({ id: "log-3" })
      },
      schedule: {
        findFirst: jest.fn().mockResolvedValue({
          messageText: "hello",
          imageUrls: [],
          groupLinks: [
            { group: { groupJid: "group-1@g.us" } },
            { group: { groupJid: "group-2@g.us" } },
            { group: { groupJid: "group-3@g.us" } }
          ]
        })
      }
    } as any;

    const sendQueue = {
      add: jest.fn().mockResolvedValue(undefined)
    } as any;

    const svc = new RunCompletenessService(prisma, sendQueue);
    await svc.reconcileRunCompleteness();

    expect(prisma.messageLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.messageLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        scheduleId: "schedule-1",
        runId: "run-1",
        groupJid: "group-3@g.us",
        status: "pending",
        errorReason: "run_completion_repair"
      },
      select: { id: true }
    });
    expect(sendQueue.add).toHaveBeenCalledTimes(1);
    expect(sendQueue.add).toHaveBeenCalledWith(
      "send",
      expect.objectContaining({
        tenantId: "tenant-1",
        scheduleId: "schedule-1",
        runId: "run-1",
        groupJid: "group-3@g.us",
        logId: "log-3"
      }),
      expect.objectContaining({
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: true
      })
    );
  });

  it("does nothing when all expected groups already have logs", async () => {
    const { RunCompletenessService } =
      await import("./run-completeness.service");

    const prisma = {
      messageLog: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              tenantId: "tenant-1",
              scheduleId: "schedule-1",
              runId: "run-1"
            }
          ])
          .mockResolvedValueOnce([
            { groupJid: "group-1@g.us" },
            { groupJid: "group-2@g.us" }
          ]),
        create: jest.fn()
      },
      schedule: {
        findFirst: jest.fn().mockResolvedValue({
          messageText: "hello",
          imageUrls: [],
          groupLinks: [
            { group: { groupJid: "group-1@g.us" } },
            { group: { groupJid: "group-2@g.us" } }
          ]
        })
      }
    } as any;

    const sendQueue = {
      add: jest.fn()
    } as any;

    const svc = new RunCompletenessService(prisma, sendQueue);
    await svc.reconcileRunCompleteness();

    expect(prisma.messageLog.create).not.toHaveBeenCalled();
    expect(sendQueue.add).not.toHaveBeenCalled();
  });
});
