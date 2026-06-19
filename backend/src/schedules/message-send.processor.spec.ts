declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const afterEach: any;

jest.mock("../whatsapp/whatsapp.service", () => ({
  WhatsAppService: class WhatsAppService {}
}));

jest.mock("../socket/whatsapp.gateway", () => ({
  WhatsAppGateway: class WhatsAppGateway {}
}));

import { MessageSendProcessor } from "./message-send.processor";

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    del: jest.fn()
  }));
});

describe("MessageSendProcessor", () => {
  const makeProcessor = () => {
    const prisma = {
      tenant: { findUnique: jest.fn() },
      messageLog: { findUnique: jest.fn(), count: jest.fn(), update: jest.fn() }
    } as any;

    const wa = {
      sendText: jest.fn()
    } as any;

    const gateway = {
      emitToTenant: jest.fn()
    } as any;

    const sendQueue = {
      add: jest.fn().mockResolvedValue(undefined)
    } as any;

    const processor = new MessageSendProcessor(prisma, wa, gateway, sendQueue);
    return { processor, prisma, wa, gateway, sendQueue };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns false immediately when lock timeout is zero", async () => {
    const { processor } = makeProcessor();

    const acquired = await (processor as any).acquireLock("tenant-lock", 0);

    expect(acquired).toBeNull();
  });

  it("requeues pending job on final attempt when tenant lock cannot be acquired", async () => {
    const { processor, prisma, sendQueue } = makeProcessor();

    prisma.messageLog.findUnique.mockResolvedValue({ status: "pending" });
    prisma.tenant.findUnique.mockResolvedValue({ timezone: "UTC" });
    prisma.messageLog.count.mockResolvedValue(0);

    jest.spyOn(processor as any, "acquireLock").mockResolvedValue(false);

    const job = {
      data: {
        tenantId: "tenant-1",
        scheduleId: "schedule-1",
        runId: "run-1",
        groupJid: "group-1@g.us",
        messageText: "hello",
        imageUrls: [],
        logId: "log-1",
        index: 0
      },
      attemptsMade: 2,
      opts: { attempts: 3 }
    } as any;

    await processor.process(job);

    expect(prisma.messageLog.update).toHaveBeenCalledWith({
      where: { id: "log-1" },
      data: { status: "pending", errorReason: "tenant_lock_busy" }
    });
    expect(sendQueue.add).toHaveBeenCalled();
  });
});
