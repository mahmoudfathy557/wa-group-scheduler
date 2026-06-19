import { BadRequestException, NotFoundException } from "@nestjs/common";
import { LogsController } from "./logs.controller";
import { LogsService } from "./logs.service";

describe("LogsController", () => {
  const mockLogsService = {
    list: jest.fn(),
    stats: jest.fn(),
    clearView: jest.fn(),
    resend: jest.fn()
  };

  const controller = new LogsController(
    mockLogsService as unknown as LogsService
  );

  beforeEach(() => jest.clearAllMocks());

  describe("list", () => {
    it("calls service with parsed query params", async () => {
      mockLogsService.list.mockResolvedValue([]);
      await controller.list("schedule-1", "sent", "100", "10");

      expect(mockLogsService.list).toHaveBeenCalledWith({
        scheduleId: "schedule-1",
        status: "sent",
        take: 100,
        skip: 10
      });
    });

    it("passes undefined for unprovided params", async () => {
      mockLogsService.list.mockResolvedValue([]);
      await controller.list(undefined, undefined, undefined, undefined);

      expect(mockLogsService.list).toHaveBeenCalledWith({
        scheduleId: undefined,
        status: undefined,
        take: undefined,
        skip: undefined
      });
    });
  });

  describe("stats", () => {
    it("returns stats from service", async () => {
      mockLogsService.stats.mockResolvedValue({
        sent: 5,
        failed: 1,
        pending: 2,
        sentToday: 3,
        stalePending: 0,
        longPending: 0,
        pendingAwaitingEnqueue: 0
      });

      const result = await controller.stats();
      expect(result).toEqual({
        sent: 5,
        failed: 1,
        pending: 2,
        sentToday: 3,
        stalePending: 0,
        longPending: 0,
        pendingAwaitingEnqueue: 0
      });
    });
  });

  describe("clearView", () => {
    it("returns clear result from service", async () => {
      const clearedAt = new Date();
      mockLogsService.clearView.mockResolvedValue({ logsClearedAt: clearedAt });

      const result = await controller.clearView();
      expect(result).toEqual({ logsClearedAt: clearedAt });
    });
  });

  describe("resend", () => {
    it("returns queued status and new log ID on success", async () => {
      mockLogsService.resend.mockResolvedValue({
        queued: true,
        logId: "new-log-123"
      });

      const result = await controller.resend("source-log-456");
      expect(mockLogsService.resend).toHaveBeenCalledWith("source-log-456");
      expect(result).toEqual({ queued: true, logId: "new-log-123" });
    });

    it("propagates NotFoundException for missing message", async () => {
      mockLogsService.resend.mockRejectedValue(
        new NotFoundException("Message log not found")
      );

      await expect(controller.resend("nonexistent")).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it("propagates BadRequestException for already-sent message", async () => {
      mockLogsService.resend.mockRejectedValue(
        new BadRequestException("Message is already sent")
      );

      await expect(controller.resend("sent-log")).rejects.toBeInstanceOf(
        BadRequestException
      );
    });
  });
});
