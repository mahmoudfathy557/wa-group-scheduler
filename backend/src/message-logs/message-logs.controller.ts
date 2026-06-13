import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessageLogsService } from './message-logs.service';

@Controller('logs')
@UseGuards(JwtAuthGuard)
export class MessageLogsController {
  constructor(private readonly messageLogsService: MessageLogsService) {}

  @Get()
  findAll(@Request() req: any, @Query('page') page = '1', @Query('limit') limit = '50') {
    return this.messageLogsService.findAll(
      req.user.id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }
}
