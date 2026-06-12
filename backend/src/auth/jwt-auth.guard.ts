import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor() {
    super();
  }

  canActivate(context: ExecutionContext) {
    const handler = context.getHandler() as any;
    const klass = context.getClass() as any;
    const isPublic =
      Reflect.getMetadata(IS_PUBLIC_KEY, handler) ??
      Reflect.getMetadata(IS_PUBLIC_KEY, klass);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any
  ) {
    if (err || !user) {
      return super.handleRequest(err, user, info, context, status);
    }
    if (user.userId && user.tenantId) {
      const req = context.switchToHttp().getRequest<any>();
      if (req) {
        req.user = user;
      }
    }
    return user;
  }
}
