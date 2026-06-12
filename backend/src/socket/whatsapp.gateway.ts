import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";

/**
 * Socket.IO namespace `/whatsapp`. Clients authenticate via JWT in the
 * handshake (auth.token or query.token). Each tenant gets a private room
 * named `tenant-{tenantId}`.
 */
@WebSocketGateway({
  namespace: "/whatsapp",
  cors: { origin: process.env.CLIENT_URL?.split(",") ?? "*", credentials: true }
})
export class WhatsAppGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(WhatsAppGateway.name);

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as any)?.token ||
        (client.handshake.query?.token as string);
      if (!token) {
        client.emit("auth:error", { reason: "missing_token" });
        return client.disconnect(true);
      }
      const payload: any = this.jwt.verify(token);
      if (!payload?.tenantId) {
        client.emit("auth:error", { reason: "invalid_token" });
        return client.disconnect(true);
      }
      client.data.tenantId = payload.tenantId;
      client.data.userId = payload.sub;
      client.join(`tenant-${payload.tenantId}`);
      client.emit("auth:ok");
    } catch (e: any) {
      this.logger.warn(`Socket auth failed: ${e?.message}`);
      client.emit("auth:error", { reason: "invalid_token" });
      client.disconnect(true);
    }
  }

  emitToTenant(tenantId: string, event: string, payload: any) {
    if (!this.server) return;
    this.server.to(`tenant-${tenantId}`).emit(event, payload);
  }
}
