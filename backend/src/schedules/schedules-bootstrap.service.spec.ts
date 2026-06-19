describe("SchedulesBootstrapService", () => {
  it("rehydrates repeat jobs for active schedules on application bootstrap", async () => {
    const { SchedulesBootstrapService } =
      await import("./schedules-bootstrap.service");

    const prisma = {
      schedule: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "schedule-1",
            tenantId: "tenant-1",
            cronExpression: "0 */1 * * *",
            timezone: "UTC",
            repeatJobKey: null
          },
          {
            id: "schedule-2",
            tenantId: "tenant-2",
            cronExpression: "0 9 * * *",
            timezone: "UTC",
            repeatJobKey: null
          }
        ])
      }
    } as any;

    const schedulesService = {
      rehydrateRepeats: jest.fn().mockResolvedValue(undefined)
    } as any;

    const svc = new SchedulesBootstrapService(prisma, schedulesService);
    await svc.onApplicationBootstrap();

    expect(prisma.schedule.findMany).toHaveBeenCalledWith({
      where: { status: "active" },
      select: {
        id: true,
        tenantId: true,
        cronExpression: true,
        timezone: true,
        repeatJobKey: true
      }
    });
    expect(schedulesService.rehydrateRepeats).toHaveBeenCalledWith([
      {
        id: "schedule-1",
        tenantId: "tenant-1",
        cronExpression: "0 */1 * * *",
        timezone: "UTC",
        repeatJobKey: null
      },
      {
        id: "schedule-2",
        tenantId: "tenant-2",
        cronExpression: "0 9 * * *",
        timezone: "UTC",
        repeatJobKey: null
      }
    ]);
  });
});
