import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SchedulesService } from "./schedules.service";

@Injectable()
export class SchedulesBootstrapService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulesService: SchedulesService
  ) {}

  async onApplicationBootstrap() {
    const activeSchedules = await this.prisma.schedule.findMany({
      where: { status: "active" },
      select: {
        id: true,
        tenantId: true,
        cronExpression: true,
        timezone: true,
        repeatJobKey: true
      }
    });

    await this.schedulesService.rehydrateRepeats(activeSchedules);
  }
}
