import { Module } from "@nestjs/common";
import { LogsService } from "./logs.service";
import { LogsController } from "./logs.controller";
import { LogsCleanupService } from "./logs-cleanup.service";

@Module({
  controllers: [LogsController],
  providers: [LogsService, LogsCleanupService],
  exports: [LogsService]
})
export class LogsModule {}
