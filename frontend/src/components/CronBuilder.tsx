import { useEffect, useState } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────

type Mode = "daily" | "weekly" | "monthly" | "hourly" | "interval" | "custom";

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
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 45];
const INTERVALS_MIN = [5, 10, 15, 20, 30, 45, 60, 120, 180, 240, 360, 720];

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
        ? weekDays.sort((a, b) => a - b).join(",")
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

// ─── component ───────────────────────────────────────────────────────────────

interface CronBuilderProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function CronBuilder({ value, onChange, error }: CronBuilderProps) {
  const parsed = parseCron(value);

  const [mode, setMode] = useState<Mode>(parsed.mode);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [weekDays, setWeekDays] = useState<number[]>(parsed.weekDays);
  const [monthDay, setMonthDay] = useState(parsed.monthDay);
  const [intervalMin, setIntervalMin] = useState(parsed.intervalMin);
  const [custom, setCustom] = useState(value);

  // Emit whenever any sub-field changes
  useEffect(() => {
    const cron = buildCron(
      mode,
      hour,
      minute,
      weekDays,
      monthDay,
      intervalMin,
      custom
    );
    if (cron !== value) onChange(cron);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hour, minute, weekDays, monthDay, intervalMin, custom]);

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

  const generated = buildCron(
    mode,
    hour,
    minute,
    weekDays,
    monthDay,
    intervalMin,
    custom
  );

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex flex-wrap gap-2">
        {MODE_LABELS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              mode === key
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-emerald-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Contextual fields */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
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
              <label className="block text-xs text-gray-500 mb-1">
                Days of week
              </label>
              <div className="flex gap-1 flex-wrap">
                {DAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={`w-10 h-10 rounded-full text-sm font-medium border transition-colors ${
                      weekDays.includes(d.value)
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-gray-700 border-gray-300 hover:border-emerald-400"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {weekDays.length === 0 && (
                <p className="text-amber-600 text-xs mt-1">
                  Select at least one day
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
              <label className="block text-xs text-gray-500 mb-1">
                Day of month
              </label>
              <select
                value={monthDay}
                onChange={(e) => setMonthDay(Number(e.target.value))}
                className="border rounded px-2 py-1 text-sm"
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
          <p className="text-sm text-gray-600">
            Triggers at the top of every hour (e.g. 1:00, 2:00, 3:00…)
          </p>
        )}

        {mode === "interval" && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Repeat every
            </label>
            <select
              value={intervalMin}
              onChange={(e) => setIntervalMin(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
            >
              {INTERVALS_MIN.map((n) => (
                <option key={n} value={n}>
                  {n < 60
                    ? `${n} minutes`
                    : `${n / 60} hour${n / 60 > 1 ? "s" : ""}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === "custom" && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Cron expression{" "}
              <a
                href="https://crontab.guru"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-emerald-600"
              >
                (help ↗)
              </a>
            </label>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              placeholder="0 9 * * *"
            />
          </div>
        )}
      </div>

      {/* Summary badge */}
      {mode !== "custom" && (
        <p className="text-xs text-gray-500">
          Schedule:{" "}
          <span className="font-medium text-gray-700">
            {humanize(generated)}
          </span>
          {" · "}
          <code className="bg-gray-100 px-1 rounded">{generated}</code>
        </p>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
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
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500">At</label>
      <select
        value={hour}
        onChange={(e) => onHour(Number(e.target.value))}
        className="border rounded px-2 py-1 text-sm"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {pad(h)}
          </option>
        ))}
      </select>
      <span className="text-gray-500">:</span>
      <select
        value={minute}
        onChange={(e) => onMinute(Number(e.target.value))}
        className="border rounded px-2 py-1 text-sm"
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
