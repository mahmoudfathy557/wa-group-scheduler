import { Module } from "@nestjs/common";
import { WhatsAppService } from "./whatsapp.service";
import { WhatsAppController } from "./whatsapp.controller";
import { BaileysAuthAdapter } from "./baileys-auth.adapter";
import { SocketModule } from "../socket/socket.module";

@Module({
  imports: [SocketModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, BaileysAuthAdapter],
  exports: [WhatsAppService]
})
export class WhatsAppModule {}
