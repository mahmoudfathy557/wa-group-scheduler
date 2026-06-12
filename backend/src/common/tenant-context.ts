import { Injectable, Scope, Inject } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";

/**
 * Request-scoped tenant context. Reads userId/tenantId from req.user which is
 * populated by JwtAuthGuard after Passport JWT validation.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  constructor(@Inject(REQUEST) private readonly req: any) {}

  private get _user(): { userId: string; tenantId: string } | null {
    return this.req?.user ?? null;
  }

  get tenantId(): string | null {
    return this._user?.tenantId ?? null;
  }

  get userId(): string | null {
    return this._user?.userId ?? null;
  }

  requireTenantId(): string {
    const id = this.tenantId;
    if (!id) throw new Error("TenantContext.tenantId is unset");
    return id;
  }
}
