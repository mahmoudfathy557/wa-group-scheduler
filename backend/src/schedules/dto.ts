import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";
import parser from "cron-parser";

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

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  groupIds!: string[];
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
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  groupIds?: string[];

  @IsOptional()
  @IsIn(["active", "paused"])
  status?: "active" | "paused";
}
