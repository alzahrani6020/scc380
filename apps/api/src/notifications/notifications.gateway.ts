import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { validateAccessSessionPayload } from '../auth/access-session';

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('NotificationsGateway');

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const rawToken =
        (typeof client.handshake.auth?.token === 'string' && client.handshake.auth.token) ||
        (typeof client.handshake.headers.authorization === 'string'
          ? client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : '');

      if (!rawToken) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwt.verify(rawToken);
      const user = await validateAccessSessionPayload(payload);
      client.data.user = user;

      if (user.tenantId) {
        await client.join(`tenant-${user.tenantId}`);
      } else if (user.role === 'SUPER_ADMIN') {
        await client.join('role-SUPER_ADMIN');
      } else {
        client.disconnect(true);
        return;
      }

      this.logger.log(`Authenticated socket connected: ${client.id}`);
      client.emit('connected', {
        message: 'Connected to SCC notifications',
        tenantId: user.tenantId || null,
      });
    } catch {
      this.logger.warn(`Rejected unauthenticated socket: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  sendToTenant(tenantId: string, event: string, data: any) {
    this.server.to(`tenant-${tenantId}`).emit(event, data);
  }

  broadcast(event: string, data: any) {
    this.server.to('role-SUPER_ADMIN').emit(event, data);
  }
}
