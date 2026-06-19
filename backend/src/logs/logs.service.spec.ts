import { LogsService } from "./logs.service";

describe("LogsService", () => {
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
