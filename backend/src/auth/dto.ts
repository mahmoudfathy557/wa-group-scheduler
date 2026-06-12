import { IsEmail, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  tenantName!: string;

  @IsString()
  timezone!: string; // IANA tz, e.g. "Africa/Cairo"
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
