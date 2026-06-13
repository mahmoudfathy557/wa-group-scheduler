import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { MessageSendProcessor } from './message-send.processor';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Module({
  imports: [BullModule.registerQueue({ name: 'message-send' }), WhatsAppModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () =>
        new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
          maxRetriesPerRequest: null,
        }),
    },
    MessageSendProcessor,
  ],
})
export class QueuesModule {}
