import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'alerts',
})
export class AlertsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const tenantId = client.handshake.headers['x-tenant-id'] as string;
    if (tenantId) {
      client.join(`tenant:${tenantId}`);
    }
  }

  handleDisconnect(client: Socket) {
    // client leaves rooms automatically on disconnect
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, tenantId: string) {
    client.join(`tenant:${tenantId}`);
  }

  sendAlert(tenantId: string, alert: any) {
    this.server.to(`tenant:${tenantId}`).emit('new-alert', alert);
  }

  sendAlertCount(tenantId: string, counts: any) {
    this.server.to(`tenant:${tenantId}`).emit('alert-counts', counts);
  }
}
