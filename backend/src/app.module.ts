import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { EncryptionModule } from './encryption/encryption.module';
import { GroupsModule } from './groups/groups.module';
import { MessageLogsModule } from './message-logs/message-logs.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueuesModule } from './queues/queues.module';
import { SchedulesModule } from './schedules/schedules.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      },
    }),
    PrismaModule,
    EncryptionModule,
    CloudinaryModule,
    AuthModule,
    WhatsAppModule,
    GroupsModule,
    SchedulesModule,
    MessageLogsModule,
    QueuesModule,
  ],
})
export class AppModule {}
