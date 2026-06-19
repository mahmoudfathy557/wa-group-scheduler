import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { LogsService } from "./logs.service";
import { LogsController } from "./logs.controller";
import { LogsCleanupService } from "./logs-cleanup.service";
import { MESSAGE_SEND_QUEUE } from "../schedules/queue.constants";

@Module({
  imports: [BullModule.registerQueue({ name: MESSAGE_SEND_QUEUE })],
  controllers: [LogsController],
  providers: [LogsService, LogsCleanupService],
  exports: [LogsService]
})
export class LogsModule {}
