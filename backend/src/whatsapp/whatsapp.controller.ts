import { Controller, Get, Post, Delete } from "@nestjs/common";
import { WhatsAppService } from "./whatsapp.service";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("whatsapp")
export class WhatsAppController {
  constructor(private readonly wa: WhatsAppService) {}

  @Get("status")
  status(@CurrentUser() user: AuthUser) {
    return {
      status: this.wa.getStatus(user.tenantId),
      qr: this.wa.getLatestQr(user.tenantId)
    };
  }

  @Post("connect")
  async connect(@CurrentUser() user: AuthUser) {
    await this.wa.connect(user.tenantId);
    return { ok: true };
  }

  @Delete("disconnect")
  async disconnect(@CurrentUser() user: AuthUser) {
    await this.wa.disconnect(user.tenantId);
    return { ok: true };
  }
}
