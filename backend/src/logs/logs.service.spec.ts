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

    const svc = new LogsService(tprisma);
    await svc.list({ status: "sent", take: 500, skip: 2 });

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        status: "sent",
        createdAt: { gt: new Date("2026-06-19T10:00:00.000Z") }
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      skip: 2
    });
  });

  it("upserts clear marker by creating when state does not exist", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const create = jest.fn().mockResolvedValue({ id: "state-1" });

    const tprisma = {
      client: {
        logViewState: { updateMany, create }
      }
    } as any;

    const svc = new LogsService(tprisma);
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

    const svc = new LogsService(tprisma);
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

    const svc = new LogsService(tprisma);
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
});
