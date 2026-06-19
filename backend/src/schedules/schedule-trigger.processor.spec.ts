import { ScheduleTriggerProcessor } from "./schedule-trigger.processor";

describe("ScheduleTriggerProcessor", () => {
  it("enqueues all groups in one addBulk for high-fanout schedule", async () => {
    const linkCount = 40;
    const links = Array.from({ length: linkCount }, (_, i) => ({
      group: { groupJid: `group-${i}@g.us` }
    }));

    const createdLogs = Array.from({ length: linkCount }, (_, i) => ({
      id: `log-${i}`
    }));

    const prisma = {
      schedule: {
        findFirst: jest.fn().mockResolvedValue({
          id: "schedule-1",
          status: "active",
          cronExpression: "0 */1 * * *",
          timezone: "UTC",
          messageText: "hello",
          imageUrls: [],
          groupLinks: links
        }),
        update: jest.fn().mockResolvedValue(undefined)
      },
      messageLog: {
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue(undefined)
      },
      $transaction: jest.fn().mockResolvedValue(createdLogs)
    } as any;

    const sendQueue = {
      addBulk: jest.fn().mockResolvedValue(undefined),
      add: jest.fn()
    } as any;

    const processor = new ScheduleTriggerProcessor(prisma, sendQueue);
    const job = {
      data: { scheduleId: "schedule-1", tenantId: "tenant-1" }
    } as any;

    await processor.process(job);

    expect(sendQueue.addBulk).toHaveBeenCalledTimes(1);
    const [bulkJobs] = sendQueue.addBulk.mock.calls[0];
    expect(bulkJobs).toHaveLength(linkCount);
    expect(bulkJobs[0]).toEqual(
      expect.objectContaining({
        name: "send",
        data: expect.objectContaining({
          tenantId: "tenant-1",
          scheduleId: "schedule-1",
          groupJid: "group-0@g.us",
          logId: "log-0",
          index: 0
        })
      })
    );
    expect(bulkJobs[linkCount - 1]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          groupJid: `group-${linkCount - 1}@g.us`,
          logId: `log-${linkCount - 1}`,
          index: linkCount - 1
        })
      })
    );
  });

  it("marks logs for retry visibility when addBulk and some fallback enqueue calls fail", async () => {
    const links = [
      { group: { groupJid: "group-1@g.us" } },
      { group: { groupJid: "group-2@g.us" } },
      { group: { groupJid: "group-3@g.us" } }
    ];

    const createdLogs = [{ id: "log-1" }, { id: "log-2" }, { id: "log-3" }];

    const prisma = {
      schedule: {
        findFirst: jest.fn().mockResolvedValue({
          id: "schedule-1",
          status: "active",
          cronExpression: "0 */1 * * *",
          timezone: "UTC",
          messageText: "hello",
          imageUrls: [],
          groupLinks: links
        }),
        update: jest.fn().mockResolvedValue(undefined)
      },
      messageLog: {
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue(undefined)
      },
      $transaction: jest.fn().mockResolvedValue(createdLogs)
    } as any;

    const sendQueue = {
      addBulk: jest.fn().mockRejectedValue(new Error("redis unavailable")),
      add: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("queue write failed"))
        .mockResolvedValueOnce(undefined)
    } as any;

    const processor = new ScheduleTriggerProcessor(prisma, sendQueue);
    const job = {
      data: { scheduleId: "schedule-1", tenantId: "tenant-1" }
    } as any;

    await processor.process(job);

    expect(sendQueue.addBulk).toHaveBeenCalledTimes(1);
    expect(sendQueue.add).toHaveBeenCalledTimes(3);
    expect(prisma.messageLog.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["log-1", "log-2", "log-3"] },
        status: "pending"
      },
      data: { errorReason: "enqueue_pending_retry" }
    });
  });

  it("safely skips when schedule is paused after trigger enqueue", async () => {
    const prisma = {
      schedule: {
        // findFirst with status: "active" filter returns null since schedule is paused
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn()
      },
      messageLog: {
        create: jest.fn(),
        updateMany: jest.fn()
      },
      $transaction: jest.fn().mockResolvedValue([])
    } as any;

    const sendQueue = {
      addBulk: jest.fn(),
      add: jest.fn()
    } as any;

    const processor = new ScheduleTriggerProcessor(prisma, sendQueue);
    const job = {
      data: { scheduleId: "schedule-1", tenantId: "tenant-1" }
    } as any;

    // Should not crash, should not enqueue any jobs
    await processor.process(job);

    expect(sendQueue.addBulk).not.toHaveBeenCalled();
    expect(sendQueue.add).not.toHaveBeenCalled();
  });

  it("safely skips when schedule is deleted after trigger enqueue", async () => {
    const prisma = {
      schedule: {
        findFirst: jest.fn().mockResolvedValue(null), // Schedule not found
        update: jest.fn()
      },
      messageLog: {
        create: jest.fn(),
        updateMany: jest.fn()
      },
      $transaction: jest.fn().mockResolvedValue([])
    } as any;

    const sendQueue = {
      addBulk: jest.fn(),
      add: jest.fn()
    } as any;

    const processor = new ScheduleTriggerProcessor(prisma, sendQueue);
    const job = {
      data: { scheduleId: "schedule-1", tenantId: "tenant-1" }
    } as any;

    // Should not crash when schedule is deleted
    await processor.process(job);

    expect(sendQueue.addBulk).not.toHaveBeenCalled();
    expect(sendQueue.add).not.toHaveBeenCalled();
  });
});
