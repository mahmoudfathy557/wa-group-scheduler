import { NotFoundException, BadRequestException } from "@nestjs/common";

describe("Logs Resend - Multi-Tenant Isolation", () => {
  it("Tenant A cannot resend Tenant B's messages (tenant isolation enforced)", async () => {
    const tenantA = "tenant-a";
    const tenantB = "tenant-b";

    // Tenant B's message log (with schedule)
    const logBData = {
      id: "log-b-1",
      tenantId: tenantB,
      scheduleId: "schedule-b",
      groupJid: "group-b@g.us",
      status: "failed" as const,
      whatsappMessageId: null,
      errorReason: null,
      runId: "run-b-1",
      createdAt: new Date(),
      schedule: {
        id: "schedule-b",
        tenantId: tenantB,
        cronExpression: "0 9 * * *",
        timezone: "UTC",
        nextRunAt: new Date(),
        imageUrls: []
      }
    };

    // Mock Tenant B's Prisma client returns the log
    const mockTprismaB = {
      client: {
        messageLog: {
          findFirst: jest.fn().mockResolvedValue(logBData),
          create: jest.fn().mockResolvedValue({
            id: "log-b-1-retry",
            tenantId: tenantB,
            scheduleId: "schedule-b",
            groupJid: "group-b@g.us",
            status: "pending",
            whatsappMessageId: null,
            errorReason: null,
            runId: "run-b-1-retry",
            createdAt: new Date()
          })
        }
      }
    } as any;

    // Mock Tenant A's Prisma client returns null (because tenantId filter excludes B's data)
    const mockTprismaA = {
      client: {
        messageLog: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn()
        }
      }
    } as any;

    const mockSendQueue = { add: jest.fn() } as any;

    // Import LogsService
    const { LogsService } = await import("./logs.service");

    // Create service instances with tenant-scoped Prisma
    const serviceB = new LogsService(mockTprismaB, mockSendQueue);
    const serviceA = new LogsService(mockTprismaA, mockSendQueue);

    // TEST 1: Tenant B can resend their own message
    const resultB = await serviceB.resend("log-b-1");
    expect(resultB.queued).toBe(true);
    expect(mockTprismaB.client.messageLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "log-b-1" }
      })
    );

    // TEST 2: Tenant A attempting to resend Tenant B's message should fail
    // Even if Tenant A somehow knows log-b-1's ID, the tenant-scoped client filters it out
    await expect(serviceA.resend("log-b-1")).rejects.toThrow(NotFoundException);
    expect(mockTprismaA.client.messageLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "log-b-1" }
      })
    );

    // Verify isolation: Tenant A's query returned null despite the ID match
    expect(mockTprismaA.client.messageLog.findFirst).toHaveBeenCalled();
  });

  it("resend rejects already-sent messages", async () => {
    // Log that is already sent
    const sentLog = {
      id: "log-sent-1",
      tenantId: "tenant-a",
      scheduleId: "schedule-a",
      groupJid: "group-a@g.us",
      status: "sent" as const,
      whatsappMessageId: "wamsg123",
      errorReason: null,
      runId: "run-a-1",
      createdAt: new Date(),
      schedule: {
        id: "schedule-a",
        tenantId: "tenant-a",
        cronExpression: "0 9 * * *",
        timezone: "UTC",
        nextRunAt: new Date(),
        imageUrls: []
      }
    };

    const mockTprisma = {
      client: {
        messageLog: {
          findFirst: jest.fn().mockResolvedValue(sentLog),
          create: jest.fn()
        }
      }
    } as any;

    const mockSendQueue = { add: jest.fn() } as any;

    const { LogsService } = await import("./logs.service");
    const service = new LogsService(mockTprisma, mockSendQueue);

    // Attempting to resend an already-sent message should fail
    await expect(service.resend("log-sent-1")).rejects.toThrow(
      BadRequestException
    );
    expect(mockSendQueue.add).not.toHaveBeenCalled();
  });
});
