import { GroupsService } from "./groups.service";

describe("GroupsService", () => {
  it("lists groups ordered by name", async () => {
    const mockGroups = [
      { id: "group-1", name: "Alpha Group", tenantId: "tenant-1" },
      { id: "group-2", name: "Beta Group", tenantId: "tenant-1" },
      { id: "group-3", name: "Gamma Group", tenantId: "tenant-1" }
    ];

    const tprisma = {
      client: {
        group: {
          findMany: jest.fn().mockResolvedValue(mockGroups)
        }
      }
    } as any;

    const prisma = {} as any;
    const wa = {} as any;

    const service = new GroupsService(tprisma, prisma, wa);
    const result = await service.list();

    expect(tprisma.client.group.findMany).toHaveBeenCalledWith({
      orderBy: { name: "asc" }
    });
    expect(result).toEqual(mockGroups);
  });

  it("syncs new groups from WhatsApp account", async () => {
    const liveGroups = [
      {
        id: "group-1@g.us",
        subject: "Sales Team",
        participants: ["p1", "p2", "p3"]
      },
      { id: "group-2@g.us", subject: "Dev Team", participants: ["p4", "p5"] }
    ];

    const mockListResult = [
      {
        id: "group-1",
        name: "Sales Team",
        tenantId: "tenant-1",
        groupJid: "group-1@g.us"
      },
      {
        id: "group-2",
        name: "Dev Team",
        tenantId: "tenant-1",
        groupJid: "group-2@g.us"
      }
    ];

    const tprisma = {
      client: {
        group: {
          findMany: jest.fn().mockResolvedValue(mockListResult)
        }
      }
    } as any;

    const prisma = {
      group: {
        upsert: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    const wa = {
      listGroups: jest.fn().mockResolvedValue(liveGroups)
    } as any;

    const service = new GroupsService(tprisma, prisma, wa);
    const result = await service.sync("tenant-1");

    expect(wa.listGroups).toHaveBeenCalledWith("tenant-1");
    expect(prisma.group.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.group.upsert).toHaveBeenNthCalledWith(1, {
      where: {
        tenantId_groupJid: { tenantId: "tenant-1", groupJid: "group-1@g.us" }
      },
      create: expect.objectContaining({
        tenantId: "tenant-1",
        groupJid: "group-1@g.us",
        name: "Sales Team"
      }),
      update: expect.any(Object)
    });
    expect(result).toEqual(mockListResult);
  });

  it("handles account switch where old groups remain in DB but new account groups are synced", async () => {
    // Simulate old account groups still in DB
    const oldMockGroups = [
      {
        id: "old-1",
        name: "Old Project",
        tenantId: "tenant-1",
        groupJid: "old-1@g.us"
      },
      {
        id: "old-2",
        name: "Old Team",
        tenantId: "tenant-1",
        groupJid: "old-2@g.us"
      }
    ];

    // New account has different groups
    const newLiveGroups = [
      { id: "new-1@g.us", subject: "New Project", participants: ["p1", "p2"] },
      { id: "new-2@g.us", subject: "New Team", participants: ["p3"] }
    ];

    const newMockListResult = [
      ...oldMockGroups, // Old groups still exist
      {
        id: "new-1",
        name: "New Project",
        tenantId: "tenant-1",
        groupJid: "new-1@g.us"
      },
      {
        id: "new-2",
        name: "New Team",
        tenantId: "tenant-1",
        groupJid: "new-2@g.us"
      }
    ];

    const tprisma = {
      client: {
        group: {
          findMany: jest.fn().mockResolvedValue(newMockListResult)
        }
      }
    } as any;

    const prisma = {
      group: {
        upsert: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    const wa = {
      listGroups: jest.fn().mockResolvedValue(newLiveGroups)
    } as any;

    const service = new GroupsService(tprisma, prisma, wa);
    const result = await service.sync("tenant-1");

    // Should upsert new groups
    expect(prisma.group.upsert).toHaveBeenCalledTimes(2);

    // List should include both old (orphaned) and new groups
    expect(result).toEqual(newMockListResult);
    expect(result.length).toBe(4);
  });
});
