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
