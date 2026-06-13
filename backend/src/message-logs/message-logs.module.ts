import { Module } from '@nestjs/common';
import { MessageLogsController } from './message-logs.controller';
import { MessageLogsService } from './message-logs.service';

@Module({
  controllers: [MessageLogsController],
  providers: [MessageLogsService],
})
export class MessageLogsModule {}
