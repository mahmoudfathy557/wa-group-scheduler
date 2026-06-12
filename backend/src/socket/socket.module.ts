import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { WhatsAppGateway } from "./whatsapp.gateway";

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET
      })
    })
  ],
  providers: [WhatsAppGateway],
  exports: [WhatsAppGateway]
})
export class SocketModule {}
