import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { LogsService } from "./logs.service";

@Controller("logs")
export class LogsController {
  constructor(private readonly svc: LogsService) {}

  @Get()
  list(
    @Query("scheduleId") scheduleId?: string,
    @Query("status") status?: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string
  ) {
    return this.svc.list({
      scheduleId,
      status,
      take: take ? parseInt(take, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined
    });
  }

  @Get("stats")
  stats() {
    return this.svc.stats();
  }

  @Post("clear-view")
  clearView() {
    return this.svc.clearView();
  }

  @Post(":id/resend")
  resend(@Param("id") id: string) {
    return this.svc.resend(id);
  }
}
