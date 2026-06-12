import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength
} from "class-validator";
import { Transform } from "class-transformer";
import parser from "cron-parser";

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

export function isValidCron(expr: string, tz?: string): boolean {
  try {
    parser.parseExpression(expr, { tz });
    return true;
  } catch {
    return false;
  }
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
}
