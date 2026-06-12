import { Module, Logger } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { BullModule } from "@nestjs/bullmq";
import { APP_GUARD } from "@nestjs/core";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";

import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { WhatsAppModule } from "./whatsapp/whatsapp.module";
import { GroupsModule } from "./groups/groups.module";
import { SchedulesModule } from "./schedules/schedules.module";
import { LogsModule } from "./logs/logs.module";
import { SocketModule } from "./socket/socket.module";
import { CommonModule } from "./common/common.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    BullModule.forRoot({
      connection: {
        // BullMQ accepts a Redis URL via parsing in @nestjs/bullmq.
        // ioredis style connection options:
        host: new URL(process.env.REDIS_URL || "redis://localhost:6379")
          .hostname,
        port: Number(
          new URL(process.env.REDIS_URL || "redis://localhost:6379").port ||
            6379
        )
      }
    }),
    CommonModule,
    PrismaModule,
    AuthModule,
    WhatsAppModule,
    GroupsModule,
    SchedulesModule,
    LogsModule,
    SocketModule
  ],
  providers: [
    Logger,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard }
  ]
})
export class AppModule {}
