import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto, RegisterDto } from "./dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async register(dto: RegisterDto) {
    // Atomic: create tenant + user together. Unique email collision is caught here.
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: dto.tenantName, timezone: dto.timezone }
        });
        const passwordHash = await bcrypt.hash(dto.password, 12);
        const user = await tx.user.create({
          data: {
            email: dto.email.toLowerCase(),
            passwordHash,
            tenantId: tenant.id
          }
        });
        return { tenant, user };
      });
      return this.signTokens(
        result.user.id,
        result.tenant.id,
        result.user.email
      );
    } catch (e: any) {
      if (e?.code === "P2002") {
        throw new ConflictException("Email already registered");
      }
      throw e;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() }
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    return this.signTokens(user.id, user.tenantId, user.email);
  }

  private signTokens(userId: string, tenantId: string, email: string) {
    const payload = { sub: userId, tenantId, email };
    const accessToken = this.jwt.sign(payload);
    return { accessToken, user: { id: userId, email, tenantId } };
  }
}
