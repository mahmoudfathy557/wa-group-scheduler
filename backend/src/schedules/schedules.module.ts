import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GroupsModule } from '../groups/groups.module';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'message-send' }), GroupsModule],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
