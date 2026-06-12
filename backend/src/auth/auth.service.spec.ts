import { ConflictException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";

jest.mock("bcrypt");

describe("AuthService", () => {
  const mockJwt = { sign: jest.fn(() => "jwt-token") };

  function buildService(prisma: any) {
    return new AuthService(prisma as any, mockJwt as any);
  }

  beforeEach(() => jest.clearAllMocks());

  describe("register", () => {
    it("creates tenant + user atomically and returns a token", async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue("HASH");
      const tx = {
        tenant: {
          create: jest.fn().mockResolvedValue({ id: "t1", name: "Acme" })
        },
        user: {
          create: jest
            .fn()
            .mockResolvedValue({ id: "u1", tenantId: "t1", email: "a@b.c" })
        }
      };
      const prisma = {
        $transaction: jest.fn(async (fn: any) => fn(tx))
      };
      const svc = buildService(prisma);

      const out = await svc.register({
        email: "A@B.C",
        password: "pw12345678",
        tenantName: "Acme",
        timezone: "UTC"
      } as any);

      expect(tx.tenant.create).toHaveBeenCalled();
      expect(tx.user.create).toHaveBeenCalledWith({
        data: { email: "a@b.c", passwordHash: "HASH", tenantId: "t1" }
      });
      expect(out).toEqual({
        accessToken: "jwt-token",
        user: { id: "u1", email: "a@b.c", tenantId: "t1" }
      });
    });

    it("throws ConflictException on duplicate email (P2002)", async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue("HASH");
      const prisma = {
        $transaction: jest.fn(async () => {
          const e: any = new Error("dup");
          e.code = "P2002";
          throw e;
        })
      };
      const svc = buildService(prisma);

      await expect(
        svc.register({
          email: "a@b.c",
          password: "pw",
          tenantName: "A",
          timezone: "UTC"
        } as any)
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("login", () => {
    it("returns token on valid credentials", async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: "u1",
            tenantId: "t1",
            email: "a@b.c",
            passwordHash: "HASH"
          })
        }
      };
      const svc = buildService(prisma);

      const out = await svc.login({ email: "A@B.C", password: "pw" } as any);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "a@b.c" }
      });
      expect(out.accessToken).toBe("jwt-token");
    });

    it("rejects unknown email", async () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue(null) }
      };
      const svc = buildService(prisma);
      await expect(
        svc.login({ email: "x@y.z", password: "pw" } as any)
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects wrong password", async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const prisma = {
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({
              id: "u1",
              passwordHash: "H",
              tenantId: "t1",
              email: "a@b.c"
            })
        }
      };
      const svc = buildService(prisma);
      await expect(
        svc.login({ email: "a@b.c", password: "pw" } as any)
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
