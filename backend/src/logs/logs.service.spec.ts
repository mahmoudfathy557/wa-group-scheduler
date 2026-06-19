/// <reference types="jest" />

import { LogsService } from "./logs.service";

describe("LogsService", () => {
  it("filters list by logsClearedAt when clear marker exists", async () => {
    const findFirst = jest.fn().mockResolvedValue({
      logsClearedAt: new Date("2026-06-19T10:00:00.000Z")
    });
    const findMany = jest.fn().mockResolvedValue([]);

    const tprisma = {
      client: {
        logViewState: { findFirst },
        messageLog: { findMany }
      }
    } as any;

    const svc = new LogsService(tprisma, {} as any);
    await svc.list({ status: "sent", take: 500, skip: 2 });

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "sent",
          createdAt: { gt: new Date("2026-06-19T10:00:00.000Z") }
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        skip: 2,
        include: {
          schedule: {
            select: {
              cronExpression: true,
              timezone: true,
              nextRunAt: true
            }
          }
        }
      })
    );
  });

  it("upserts clear marker by creating when state does not exist", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const create = jest.fn().mockResolvedValue({ id: "state-1" });

    const tprisma = {
      client: {
        logViewState: { updateMany, create }
      }
    } as any;

    const svc = new LogsService(tprisma, {} as any);
    const result = await svc.clearView();

    expect(updateMany).toHaveBeenCalledWith({
      where: {},
      data: { logsClearedAt: expect.any(Date) }
    });
    expect(create).toHaveBeenCalledWith({
      data: { logsClearedAt: expect.any(Date) }
    });
    expect(result).toEqual({ logsClearedAt: expect.any(Date) });
  });

  it("upserts clear marker by updating existing state", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn();

    const tprisma = {
      client: {
        logViewState: { updateMany, create }
      }
    } as any;

    const svc = new LogsService(tprisma, {} as any);
    await svc.clearView();

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns recovery health counters in stats", async () => {
    const messageLog = {
      count: jest
        .fn()
        .mockResolvedValueOnce(12)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(4)
    };

    const tprisma = {
      client: {
        messageLog
      }
    } as any;

    const svc = new LogsService(tprisma, {} as any);
    const result = await svc.stats();

    expect(result).toEqual({
      sent: 12,
      failed: 3,
      pending: 8,
      sentToday: 7,
      stalePending: 2,
      longPending: 1,
      pendingAwaitingEnqueue: 4
    });
    expect(messageLog.count).toHaveBeenCalledTimes(7);
  });

  it("adds nextRetryAt for non-sent logs when listing", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "log-1",
        scheduleId: "s-1",
        groupJid: "g-1",
        status: "pending",
        errorReason: null,
        whatsappMessageId: null,
        createdAt: new Date("2026-06-19T10:05:00.000Z"),
        schedule: {
          cronExpression: "*/30 * * * *",
          timezone: "UTC",
          nextRunAt: new Date(Date.now() + 60_000)
        }
      },
      {
        id: "log-2",
        scheduleId: "s-1",
        groupJid: "g-2",
        status: "sent",
        errorReason: null,
        whatsappMessageId: "wa-1",
        createdAt: new Date("2026-06-19T10:06:00.000Z"),
        schedule: {
          cronExpression: "*/30 * * * *",
          timezone: "UTC",
          nextRunAt: new Date(Date.now() + 60_000)
        }
      }
    ]);

    const tprisma = {
      client: {
        logViewState: { findFirst },
        messageLog: { findMany }
      }
    } as any;

    const svc = new LogsService(tprisma, {} as any);
    const result = await svc.list({});

    expect(result[0].nextRetryAt).toEqual(expect.any(String));
    expect(result[1].nextRetryAt).toBeNull();
  });

  it("resend creates a new pending log and enqueues send job", async () => {
    const add = jest.fn().mockResolvedValue({ id: "job-1" });
    const findFirst = jest.fn().mockResolvedValue({
      id: "log-src",
      tenantId: "tenant-1",
      scheduleId: "schedule-1",
      groupJid: "123@g.us",
      status: "failed",
      schedule: {
        id: "schedule-1",
        messageText: "hello",
        imageUrls: []
      }
    });
    const create = jest.fn().mockResolvedValue({ id: "log-retry" });

    const tprisma = {
      client: {
        messageLog: { findFirst, create }
      }
    } as any;

    const svc = new LogsService(tprisma, { add } as any);
    const result = await svc.resend("log-src");

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "log-src" } })
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scheduleId: "schedule-1",
          groupJid: "123@g.us",
          status: "pending"
        })
      })
    );
    expect(add).toHaveBeenCalledWith(
      "send",
      expect.objectContaining({
        tenantId: "tenant-1",
        scheduleId: "schedule-1",
        groupJid: "123@g.us",
        logId: "log-retry"
      }),
      expect.objectContaining({ jobId: "log-retry" })
    );
    expect(result).toEqual({ queued: true, logId: "log-retry" });
  });

  it("resend rejects already sent logs", async () => {
    const tprisma = {
      client: {
        messageLog: {
          findFirst: jest.fn().mockResolvedValue({
            id: "log-sent",
            status: "sent",
            schedule: { id: "s", messageText: "x", imageUrls: [] }
          })
        }
      }
    } as any;

    const svc = new LogsService(tprisma, {} as any);

    await expect(svc.resend("log-sent")).rejects.toThrow(
      "Message is already sent"
    );
  });
});
