import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { MessageSendProcessor } from './message-send.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'message-send' }), WhatsAppModule],
  providers: [MessageSendProcessor],
})
export class QueuesModule {}
