import { parseExpression } from 'cron-parser';
import { DateTime } from 'luxon';

const MIN_INTERVAL_MS = 30 * 60 * 1000;

export function validateCronMinInterval(cronExpr: string, timezone = 'UTC'): void {
  const interval = parseExpression(cronExpr, {
    tz: timezone,
    currentDate: new Date(),
  });
  const t1 = interval.next().toDate().getTime();
  const t2 = interval.next().toDate().getTime();
  const diffMs = t2 - t1;
  if (diffMs < MIN_INTERVAL_MS) {
    throw new Error(`Cron interval is too frequent (${diffMs}ms). Minimum is 30 minutes.`);
  }
}

export function detectIntervalPattern(cronExpr: string): { isInterval: boolean; everyMs?: number } {
  const minuteInterval = cronExpr.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (minuteInterval) {
    const n = parseInt(minuteInterval[1], 10);
    return { isInterval: true, everyMs: n * 60 * 1000 };
  }
  const hourInterval = cronExpr.match(/^0\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
  if (hourInterval) {
    const n = parseInt(hourInterval[1], 10);
    return { isInterval: true, everyMs: n * 60 * 60 * 1000 };
  }
  return { isInterval: false };
}

export function getDayStartInTimezone(timezone: string): Date {
  return DateTime.now().setZone(timezone).startOf('day').toJSDate();
}

export function getDayEndInTimezone(timezone: string): Date {
  return DateTime.now().setZone(timezone).endOf('day').toJSDate();
}
