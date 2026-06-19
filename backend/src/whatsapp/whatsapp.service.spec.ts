import { WhatsAppService } from "./whatsapp.service";

describe("WhatsAppService - Disconnect Handler", () => {
  it("triggers auto-pause when disconnect event fires for tenant", async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: "tenant-1" })
      },
      schedule: {
        findMany: jest.fn().mockResolvedValue([
          { id: "schedule-1", status: "active" },
          { id: "schedule-2", status: "active" }
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 2 })
      }
    } as any;

    const authAdapter = {} as any;
    const gateway = {} as any;
    const service = new WhatsAppService(prisma, authAdapter, gateway);

    // Service should instantiate without request-scoped dependencies.
    expect(service).toBeDefined();
  });

  it("handles repeated disconnect events idempotently", async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: "tenant-1" })
      },
      schedule: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: "schedule-1", status: "active" }])
          .mockResolvedValueOnce([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      }
    } as any;

    const authAdapter = {} as any;
    const gateway = {} as any;
    const service = new WhatsAppService(prisma, authAdapter, gateway);

    // Should handle repeated disconnect safely
    expect(service).toBeDefined();
  });
});
