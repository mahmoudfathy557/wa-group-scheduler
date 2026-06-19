import { isValidCron } from "./dto";
import parser from "cron-parser";

describe("schedules dto / cron helpers", () => {
  describe("isValidCron", () => {
    it("accepts standard 5-field cron with timezone", () => {
      expect(isValidCron("0 9 * * *", "America/New_York")).toBe(true);
      expect(isValidCron("*/30 * * * *", "UTC")).toBe(true);
      expect(isValidCron("0 9 * * 1-5", "Europe/London")).toBe(true);
    });

    it("rejects cron expressions that run more often than every 30 minutes", () => {
      expect(isValidCron("* * * * *", "UTC")).toBe(false);
      expect(isValidCron("*/15 * * * *", "UTC")).toBe(false);
      expect(isValidCron("0,15 * * * *", "UTC")).toBe(false);
    });

    it("rejects garbage expressions", () => {
      expect(isValidCron("not a cron", "UTC")).toBe(false);
      expect(isValidCron("99 99 99 99 99", "UTC")).toBe(false);
      expect(isValidCron("", "UTC")).toBe(false);
    });

    it("rejects invalid IANA timezone", () => {
      expect(isValidCron("0 9 * * *", "Mars/Olympus")).toBe(false);
    });
  });

  describe("cron-parser timezone semantics", () => {
    it("computes next run in target timezone, not UTC", () => {
      // 9am every day in New York. From a midnight UTC reference point.
      const ref = new Date("2025-06-15T00:00:00Z"); // EDT = UTC-4 → 9am NY = 13:00 UTC
      const it = parser.parseExpression("0 9 * * *", {
        tz: "America/New_York",
        currentDate: ref
      });
      const next = it.next().toDate();
      expect(next.toISOString()).toBe("2025-06-15T13:00:00.000Z");
    });

    it("computes daily 09:00 Tokyo correctly (UTC+9)", () => {
      const ref = new Date("2025-06-15T00:00:00Z");
      const it = parser.parseExpression("0 9 * * *", {
        tz: "Asia/Tokyo",
        currentDate: ref
      });
      // 09:00 JST = 00:00 UTC same day, but ref is exactly 00:00 UTC so .next()
      // returns the FOLLOWING day's run.
      const next = it.next().toDate();
      expect(next.toISOString()).toBe("2025-06-16T00:00:00.000Z");
    });
  });
});

describe("SchedulesService - Disconnect Auto-Pause", () => {
  it("pauses all active schedules for tenant when disconnect event fires", async () => {
    const { SchedulesService } = await import("./schedules.service");

    const tprisma = {
      client: {
        schedule: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: "schedule-1",
              status: "active",
              tenantId: "tenant-1",
              repeatJobKey: "repeat-1"
            },
            {
              id: "schedule-2",
              status: "active",
              tenantId: "tenant-1",
              repeatJobKey: "repeat-2"
            }
          ]),
          updateMany: jest.fn().mockResolvedValue({ count: 2 })
        }
      }
    } as any;

    const prisma = {
      schedule: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 })
      }
    } as any;

    const ctx = {
      requireTenantId: jest.fn().mockReturnValue("tenant-1")
    } as any;

    const triggerQueue = {
      removeRepeatable: jest.fn().mockResolvedValue(undefined)
    } as any;

    const scheduleService = new SchedulesService(
      tprisma,
      prisma,
      ctx,
      triggerQueue
    );

    // Call pauseAllActive to simulate disconnect event triggering auto-pause
    const result = await scheduleService.pauseAllActive();

    // Verify all active schedules were paused
    expect(result.pausedCount).toBe(2);
    expect(tprisma.client.schedule.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["schedule-1", "schedule-2"] } },
        data: { status: "paused" }
      })
    );

    // Verify repeat jobs were removed
    expect(triggerQueue.removeRepeatable).toHaveBeenCalledTimes(2);
  });

  it("keeps pause idempotent when repeated disconnect events occur", async () => {
    const { SchedulesService } = await import("./schedules.service");

    const tprisma = {
      client: {
        schedule: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([
              {
                id: "schedule-1",
                status: "active",
                tenantId: "tenant-1",
                repeatJobKey: "repeat-1"
              }
            ])
            .mockResolvedValueOnce([]), // Second call returns empty (already paused)
          updateMany: jest.fn().mockResolvedValue({ count: 1 })
        }
      }
    } as any;

    const prisma = {
      schedule: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      }
    } as any;

    const ctx = {
      requireTenantId: jest.fn().mockReturnValue("tenant-1")
    } as any;

    const triggerQueue = {
      removeRepeatable: jest.fn().mockResolvedValue(undefined)
    } as any;

    const scheduleService = new SchedulesService(
      tprisma,
      prisma,
      ctx,
      triggerQueue
    );

    // First disconnect: pause 1 schedule
    const result1 = await scheduleService.pauseAllActive();
    expect(result1.pausedCount).toBe(1);

    // Second disconnect: no active schedules left (already paused from first call)
    const result2 = await scheduleService.pauseAllActive();
    expect(result2.pausedCount).toBe(0);

    // Verify repeated calls remain safe and idempotent
    expect(tprisma.client.schedule.findMany).toHaveBeenCalledTimes(2);
  });
});
