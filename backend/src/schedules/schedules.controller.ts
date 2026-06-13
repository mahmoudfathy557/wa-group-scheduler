import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulesService } from './schedules.service';

@Controller('schedules')
@UseGuards(JwtAuthGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.schedulesService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.schedulesService.findOne(req.user.id, id);
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateScheduleDto) {
    return this.schedulesService.create(req.user.id, dto);
  }

  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.schedulesService.update(req.user.id, id, dto);
  }

  @Patch(':id/pause')
  pause(@Request() req: any, @Param('id') id: string) {
    return this.schedulesService.pause(req.user.id, id);
  }

  @Patch(':id/resume')
  resume(@Request() req: any, @Param('id') id: string) {
    return this.schedulesService.resume(req.user.id, id);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.schedulesService.remove(req.user.id, id);
  }
}
