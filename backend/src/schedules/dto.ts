import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength
} from "class-validator";
import { Transform } from "class-transformer";
import parser from "cron-parser";

export const MIN_CRON_INTERVAL_MINUTES = 30;
export const CRON_MIN_INTERVAL_ERROR_MESSAGE =
  "Cron period must be 30 minutes or more";

function parseExplicitIntervalMinutes(expr: string): number | null {
  const cron = expr.trim();

  // Every N minutes.
  const everyMinutes = cron.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (everyMinutes) return Number(everyMinutes[1]);

  // Every N hours.
  const everyHours = cron.match(/^0\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
  if (everyHours) return Number(everyHours[1]) * 60;

  return null;
}

function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return trimmed.includes(",")
      ? trimmed
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [trimmed];
  }
  return [String(value)];
}

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
  }
  return Boolean(value);
}

export function isValidCronSyntax(expr: string, tz?: string): boolean {
  try {
    parser.parseExpression(expr, { tz });
    return true;
  } catch {
    return false;
  }
}

export function isCronAtLeastMinInterval(
  expr: string,
  tz?: string,
  minMinutes = MIN_CRON_INTERVAL_MINUTES
): boolean {
  const explicitInterval = parseExplicitIntervalMinutes(expr);
  if (explicitInterval !== null) {
    return explicitInterval >= minMinutes;
  }

  try {
    const it = parser.parseExpression(expr, { tz });
    const first = it.next().toDate();
    const second = it.next().toDate();
    return second.getTime() - first.getTime() >= minMinutes * 60 * 1000;
  } catch {
    return false;
  }
}

export function isValidCron(expr: string, tz?: string): boolean {
  return (
    isValidCronSyntax(expr, tz) &&
    isCronAtLeastMinInterval(expr, tz, MIN_CRON_INTERVAL_MINUTES)
  );
}

export class CreateScheduleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  messageText!: string;

  @IsString()
  cronExpression!: string;

  @IsString()
  timezone!: string;

  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  groupIds!: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  imageUrls?: string[];

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  runNow?: boolean;
}

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  messageText?: string;

  @IsOptional()
  @IsString()
  cronExpression?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  groupIds?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsIn(["active", "paused"])
  status?: "active" | "paused";

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  runNow?: boolean;
}
