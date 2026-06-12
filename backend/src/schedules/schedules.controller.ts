import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post
} from "@nestjs/common";
import { SchedulesService } from "./schedules.service";
import { CreateScheduleDto, UpdateScheduleDto } from "./dto";

@Controller("schedules")
export class SchedulesController {
  constructor(private readonly svc: SchedulesService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.svc.get(id);
  }

  @Post()
  create(@Body() dto: CreateScheduleDto) {
    return this.svc.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateScheduleDto) {
    return this.svc.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
  }

  @Post(":id/pause")
  pause(@Param("id") id: string) {
    return this.svc.pause(id);
  }

  @Post(":id/resume")
  resume(@Param("id") id: string) {
    return this.svc.resume(id);
  }
}
