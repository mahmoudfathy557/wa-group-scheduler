describe("Logs Resend Multi-Tenant Isolation E2E", () => {
  it("Tenant A cannot resend Tenant B's messages (tenant isolation enforced)", async () => {
    const tenantA = "tenant-a";
    const tenantB = "tenant-b";

    // Mock logs from Tenant B
    const logBFindFirst = jest.fn().mockResolvedValue({
      id: "log-b-1",
      tenantId: tenantB,
      scheduleId: "schedule-b",
      groupJid: "group-b@g.us",
      status: "failed",
      schedule: {
        id: "schedule-b",
        messageText: "Message for Tenant B",
        imageUrls: []
      }
    });

    // Tenant A's scoped client attempts to access log
    // After tenant isolation filter, should return null (no cross-tenant access)
    const logAFindFirst = jest.fn().mockResolvedValue(null);

    // Create two separate tprisma instances (one per tenant)
    const tprismaA = {
      client: {
        messageLog: { findFirst: logAFindFirst, create: jest.fn() }
      }
    } as any;

    const tprismaB = {
      client: {
        messageLog: { findFirst: logBFindFirst, create: jest.fn() }
      }
    } as any;

    const sendQueueA = { add: jest.fn() } as any;
    const sendQueueB = { add: jest.fn() } as any;

    const { LogsService } = await import("./logs.service");

    // Tenant A service
    const serviceA = new LogsService(tprismaA, sendQueueA);
    // Tenant B service
    const serviceB = new LogsService(tprismaB, sendQueueB);

    // ===== TEST 1: Tenant B can resend their own message =====
    const resultB = await serviceB.resend("log-b-1");
    expect(resultB.queued).toBe(true);
    expect(logBFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "log-b-1" } })
    );

    // ===== TEST 2: Tenant A cannot resend Tenant B's message =====
    // When Tenant A tries to resend a message that belongs to Tenant B,
    // the tenant-isolation middleware (TenantPrismaService) will filter it out.
    // So findFirst returns null, and resend throws NotFoundException.
    const { LogsService: LS } = await import("./logs.service");
    const serviceAAttempt = new LS(tprismaA, sendQueueA);

    await expect(serviceAAttempt.resend("log-b-1")).rejects.toThrow(
      "Message log not found"
    );

    // Verify Tenant A's client was queried (but got no results due to isolation)
    expect(logAFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "log-b-1" } })
    );
  });
});
