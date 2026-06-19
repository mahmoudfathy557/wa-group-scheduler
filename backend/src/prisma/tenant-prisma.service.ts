import { Injectable, Scope } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { TenantContext } from "../common/tenant-context";

// Models that carry a tenantId column and must be auto-scoped.
const TENANT_MODELS = new Set([
  "WhatsAppSession",
  "WhatsAppAuthKey",
  "Group",
  "Schedule",
  "MessageLog",
  "LogViewState"
]);

const READ_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy"
]);
const UPDATE_DELETE_OPS = new Set([
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert"
]);
const CREATE_OPS = new Set(["create", "createMany"]);

/**
 * Request-scoped, tenant-isolated Prisma client. The extension:
 *  - injects { tenantId } into where for read/update/delete
 *  - injects { tenantId } into data for create
 *  - throws if tenant context is missing
 *
 * This is the SINGLE point of defense for cross-tenant access.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService {
  readonly client: ReturnType<typeof this.build>;

  constructor(
    prisma: PrismaService,
    private readonly ctx: TenantContext
  ) {
    this.client = this.build(prisma);
  }

  private build(prisma: PrismaService) {
    const ctx = this.ctx;
    return prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !TENANT_MODELS.has(model)) {
              return query(args);
            }
            const tenantId = ctx.requireTenantId();

            if (READ_OPS.has(operation) || UPDATE_DELETE_OPS.has(operation)) {
              const a: any = args ?? {};
              a.where = a.where
                ? { AND: [a.where, { tenantId }] }
                : { tenantId };
              return query(a);
            }

            if (CREATE_OPS.has(operation)) {
              const a: any = args ?? {};
              if (operation === "createMany") {
                const data = Array.isArray(a.data) ? a.data : [a.data];
                a.data = data.map((d: any) => ({ ...d, tenantId }));
              } else {
                a.data = { ...a.data, tenantId };
              }
              return query(a);
            }

            return query(args);
          }
        }
      }
    }) as unknown as PrismaClientWithExtension;
  }
}

// Loose type alias — Prisma's extended client type is intentionally opaque.
type PrismaClientWithExtension = ReturnType<PrismaService["$extends"]>;
export type ScopedPrisma = PrismaClientWithExtension;

// Helper for accessing Prisma type namespace from consumers.
export const PrismaTypes = Prisma;
