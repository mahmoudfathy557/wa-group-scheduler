import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class WhatsAppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WhatsAppGateway.name);
  private readonly tenantSockets = new Map<string, Set<string>>();

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const headerAuth = client.handshake.headers?.authorization;
      const token = client.handshake.auth?.token || headerAuth?.replace('Bearer ', '');
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<{ sub: string }>(token);
      client.data.tenantId = payload.sub;

      if (!this.tenantSockets.has(payload.sub)) {
        this.tenantSockets.set(payload.sub, new Set());
      }
      this.tenantSockets.get(payload.sub)?.add(client.id);

      client.join(`tenant:${payload.sub}`);
      this.logger.log(`Client ${client.id} connected for tenant ${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const tenantId = client.data.tenantId as string | undefined;
    if (!tenantId) {
      return;
    }

    const sockets = this.tenantSockets.get(tenantId);
    sockets?.delete(client.id);
    if (sockets && sockets.size === 0) {
      this.tenantSockets.delete(tenantId);
    }
  }

  emitToTenant(tenantId: string, event: string, data: any) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }
}
