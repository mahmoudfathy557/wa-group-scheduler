import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { SchedulesService } from "./schedules.service";
import { SchedulesController } from "./schedules.controller";
import { ScheduleTriggerProcessor } from "./schedule-trigger.processor";
import { MessageSendProcessor } from "./message-send.processor";
import { PendingReconcileService } from "./pending-reconcile.service";
import { RunCompletenessService } from "./run-completeness.service";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { SocketModule } from "../socket/socket.module";
import { MESSAGE_SEND_QUEUE, SCHEDULE_TRIGGER_QUEUE } from "./queue.constants";

@Module({
  imports: [
    WhatsAppModule,
    SocketModule,
    BullModule.registerQueue(
      { name: SCHEDULE_TRIGGER_QUEUE },
      { name: MESSAGE_SEND_QUEUE }
    )
  ],
  controllers: [SchedulesController],
  providers: [
    SchedulesService,
    ScheduleTriggerProcessor,
    MessageSendProcessor,
    PendingReconcileService,
    RunCompletenessService
  ],
  exports: [SchedulesService]
})
export class SchedulesModule {}
