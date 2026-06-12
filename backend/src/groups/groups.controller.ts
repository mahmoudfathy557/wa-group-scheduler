import { Controller, Get, Post } from "@nestjs/common";
import { GroupsService } from "./groups.service";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("groups")
export class GroupsController {
  constructor(private readonly svc: GroupsService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post("sync")
  sync(@CurrentUser() user: AuthUser) {
    return this.svc.sync(user.tenantId);
  }
}
