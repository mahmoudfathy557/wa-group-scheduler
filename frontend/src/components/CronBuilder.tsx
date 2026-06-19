import { useEffect, useMemo, useRef, useState } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────

type Mode = "daily" | "weekly" | "monthly" | "hourly" | "interval" | "custom";

export const MIN_CRON_INTERVAL_MINUTES = 30;

const DAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 }
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 30, 45];
const INTERVALS_MIN = [30, 45, 60, 120, 180, 240, 360, 720];

function minimumGapBetweenMinutes(minutes: number[]): number {
  const sorted = [...new Set(minutes)].sort((a, b) => a - b);
  if (sorted.length < 2) return 60;

  let minGap = 60;
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = i === sorted.length - 1 ? sorted[0] + 60 : sorted[i + 1];
    minGap = Math.min(minGap, next - current);
  }
  return minGap;
}

export function violatesMinCronInterval(
  expr: string,
  minMinutes = MIN_CRON_INTERVAL_MINUTES
): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minuteField] = parts;
  if (minuteField === "*") return true;

  const everyNMinutesMatch = minuteField.match(/^\*\/(\d+)$/);
  if (everyNMinutesMatch) {
    return Number(everyNMinutesMatch[1]) < minMinutes;
  }

  const rangeStepMatch = minuteField.match(/^(\d+)-(\d+)\/(\d+)$/);
  if (rangeStepMatch) {
    return Number(rangeStepMatch[3]) < minMinutes;
  }

  if (/^\d+(,\d+)+$/.test(minuteField)) {
    const values = minuteField.split(",").map((v) => Number(v));
    return minimumGapBetweenMinutes(values) < minMinutes;
  }

  return false;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function buildCron(
  mode: Mode,
  hour: number,
  minute: number,
  weekDays: number[],
  monthDay: number,
  intervalMin: number,
  custom: string
): string {
  switch (mode) {
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly": {
      const days = weekDays.length
        ? [...weekDays].sort((a, b) => a - b).join(",")
        : "*";
      return `${minute} ${hour} * * ${days}`;
    }
    case "monthly":
      return `${minute} ${hour} ${monthDay} * *`;
    case "hourly":
      return `0 * * * *`;
    case "interval":
      if (intervalMin < 60) return `*/${intervalMin} * * * *`;
      return `0 */${intervalMin / 60} * * *`;
    case "custom":
      return custom;
  }
}

/** Try to detect a mode from an existing cron expression */
function parseCron(cron: string): {
  mode: Mode;
  hour: number;
  minute: number;
  weekDays: number[];
  monthDay: number;
  intervalMin: number;
} {
  const parts = cron.trim().split(/\s+/);
  const defaults = {
    mode: "custom" as Mode,
    hour: 9,
    minute: 0,
    weekDays: [1],
    monthDay: 1,
    intervalMin: 30
  };

  if (parts.length !== 5) return defaults;
  const [min, hr, dom, month, dow] = parts;

  if (month !== "*") return defaults;

  // every-N-minutes: */N * * * *
  if (/^\*\/\d+$/.test(min) && hr === "*" && dom === "*" && dow === "*") {
    const n = parseInt(min.slice(2));
    if (n < MIN_CRON_INTERVAL_MINUTES) return defaults;
    return { ...defaults, mode: "interval", intervalMin: n };
  }

  // every-N-hours: 0 */N * * *
  if (/^\*\/\d+$/.test(hr) && /^\d+$/.test(min) && dom === "*" && dow === "*") {
    const n = parseInt(hr.slice(2));
    return {
      ...defaults,
      mode: "interval",
      intervalMin: n * 60,
      minute: parseInt(min)
    };
  }

  // every hour: 0 * * * *
  if (min === "0" && hr === "*" && dom === "*" && dow === "*") {
    return { ...defaults, mode: "hourly" };
  }

  const h = parseInt(hr);
  const m = parseInt(min);
  if (isNaN(h) || isNaN(m)) return defaults;

  // monthly: M H D * *
  if (/^\d+$/.test(dom) && dow === "*") {
    return {
      ...defaults,
      mode: "monthly",
      hour: h,
      minute: m,
      monthDay: parseInt(dom)
    };
  }

  // weekly: M H * * D(,D)*
  if (dom === "*" && /^[\d,]+$/.test(dow)) {
    const days = dow.split(",").map(Number);
    return { ...defaults, mode: "weekly", hour: h, minute: m, weekDays: days };
  }

  // daily: M H * * *
  if (dom === "*" && dow === "*") {
    return { ...defaults, mode: "daily", hour: h, minute: m };
  }

  return defaults;
}

function humanize(cron: string): string {
  const p = parseCron(cron);
  const t = `${pad(p.hour)}:${pad(p.minute)}`;
  switch (p.mode) {
    case "daily":
      return `Every day at ${t}`;
    case "weekly": {
      const names = p.weekDays.map((d) => DAYS[d]?.label ?? d).join(", ");
      return `Every ${names} at ${t}`;
    }
    case "monthly":
      return `Every month on the ${p.monthDay}${ordinal(p.monthDay)} at ${t}`;
    case "hourly":
      return "Every hour";
    case "interval":
      return p.intervalMin < 60
        ? `Every ${p.intervalMin} minutes`
        : `Every ${p.intervalMin / 60} hour(s)`;
    default:
      return cron;
  }
}

function ordinal(n: number) {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function sameNumberArray(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ─── component ───────────────────────────────────────────────────────────────

interface CronBuilderProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function CronBuilder({ value, onChange, error }: CronBuilderProps) {
  const initialParsedRef = useRef(parseCron(value));
  const internalUpdateRef = useRef(false);

  const [mode, setMode] = useState<Mode>(initialParsedRef.current.mode);
  const [hour, setHour] = useState(initialParsedRef.current.hour);
  const [minute, setMinute] = useState(initialParsedRef.current.minute);
  const [weekDays, setWeekDays] = useState<number[]>(
    initialParsedRef.current.weekDays
  );
  const [monthDay, setMonthDay] = useState(initialParsedRef.current.monthDay);
  const [intervalMin, setIntervalMin] = useState(
    initialParsedRef.current.intervalMin
  );
  const [custom, setCustom] = useState(value);

  const generated = useMemo(
    () =>
      buildCron(mode, hour, minute, weekDays, monthDay, intervalMin, custom),
    [mode, hour, minute, weekDays, monthDay, intervalMin, custom]
  );

  // Keep local editor state aligned when form value is hydrated externally.
  useEffect(() => {
    if (internalUpdateRef.current) {
      internalUpdateRef.current = false;
      return;
    }

    const next = parseCron(value);
    setMode(next.mode);
    setHour(next.hour);
    setMinute(next.minute);
    setWeekDays((prev) =>
      sameNumberArray(prev, next.weekDays) ? prev : next.weekDays
    );
    setMonthDay(next.monthDay);
    setIntervalMin(next.intervalMin);
    setCustom(value);
  }, [value]);

  // Emit whenever any sub-field changes
  useEffect(() => {
    if (generated !== value) {
      internalUpdateRef.current = true;
      onChange(generated);
    }
  }, [generated, onChange, value]);

  function toggleDay(d: number) {
    setWeekDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  const MODE_LABELS: { key: Mode; label: string }[] = [
    { key: "daily", label: "Daily" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
    { key: "hourly", label: "Hourly" },
    { key: "interval", label: "Every N min" },
    { key: "custom", label: "Custom cron" }
  ];

  const customIntervalError =
    mode === "custom" && violatesMinCronInterval(custom)
      ? `Cron period must be ${MIN_CRON_INTERVAL_MINUTES} minutes or more`
      : undefined;

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex flex-wrap gap-2">
        {MODE_LABELS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border transition-colors ${
              mode === key
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                : "bg-white text-gray-700 border-gray-300 hover:border-emerald-400 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Contextual fields */}
      <div className="bg-gray-50 rounded-lg p-4 sm:p-5 space-y-4">
        {mode === "daily" && (
          <TimePicker
            hour={hour}
            minute={minute}
            onHour={setHour}
            onMinute={setMinute}
          />
        )}

        {mode === "weekly" && (
          <>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-3">
                Days of week
              </label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full text-xs sm:text-sm font-semibold border-2 transition-colors ${
                      weekDays.includes(d.value)
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                        : "bg-white text-gray-700 border-gray-300 hover:border-emerald-400 hover:bg-gray-100"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {weekDays.length === 0 && (
                <p className="text-amber-700 text-xs mt-2 font-medium">
                  ⚠ Select at least one day
                </p>
              )}
            </div>
            <TimePicker
              hour={hour}
              minute={minute}
              onHour={setHour}
              onMinute={setMinute}
            />
          </>
        )}

        {mode === "monthly" && (
          <>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Day of month
              </label>
              <select
                value={monthDay}
                onChange={(e) => setMonthDay(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                    {ordinal(d)}
                  </option>
                ))}
              </select>
            </div>
            <TimePicker
              hour={hour}
              minute={minute}
              onHour={setHour}
              onMinute={setMinute}
            />
          </>
        )}

        {mode === "hourly" && (
          <p className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
            ⓘ Triggers at the top of every hour (1:00, 2:00, 3:00…)
          </p>
        )}

        {mode === "interval" && (
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Repeat every
            </label>
            <select
              value={intervalMin}
              onChange={(e) => setIntervalMin(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            >
              {INTERVALS_MIN.map((n) => (
                <option key={n} value={n}>
                  {n < 60
                    ? `${n} minutes`
                    : `${n / 60} hour${n / 60 > 1 ? "s" : ""}`}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Minimum interval: 30 minutes. Runs from save time.
            </p>
          </div>
        )}

        {mode === "custom" && (
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Cron expression{" "}
              <a
                href="https://crontab.guru"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                (help ↗)
              </a>
            </label>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              placeholder="0 9 * * *"
            />
            {customIntervalError && (
              <p className="text-amber-700 text-xs mt-2 font-medium">
                ⚠ {customIntervalError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Summary badge */}
      {mode !== "custom" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs sm:text-sm">
          <p className="text-gray-700">
            <span className="font-semibold">Schedule:</span>{" "}
            {humanize(generated)}
          </p>
          <p className="text-gray-500 mt-1 break-all">
            <code className="bg-white border border-gray-200 px-2 py-1 rounded font-mono text-xs">
              {generated}
            </code>
          </p>
        </div>
      )}

      {(error || customIntervalError) && (
        <p className="text-red-600 text-sm font-medium bg-red-50 border border-red-200 rounded-lg p-3">
          {error || customIntervalError}
        </p>
      )}
    </div>
  );
}

// ─── sub-component: time picker ───────────────────────────────────────────────

function TimePicker({
  hour,
  minute,
  onHour,
  onMinute
}: {
  hour: number;
  minute: number;
  onHour: (h: number) => void;
  onMinute: (m: number) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-2">
      <label className="text-xs sm:text-sm font-medium text-gray-700">At</label>
      <select
        value={hour}
        onChange={(e) => onHour(Number(e.target.value))}
        className="flex-1 sm:flex-initial border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {pad(h)}
          </option>
        ))}
      </select>
      <span className="text-gray-500 hidden sm:inline">:</span>
      <select
        value={minute}
        onChange={(e) => onMinute(Number(e.target.value))}
        className="flex-1 sm:flex-initial border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {pad(m)}
          </option>
        ))}
      </select>
    </div>
  );
}
