import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import * as cookie from 'cookie';
import * as jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { getCORSWhiteList } from 'src/config/cors';
import environment from 'src/config/environment';
import { Notice } from 'src/schemas/notice';

@WebSocketGateway({
  cors: {
    origin: getCORSWhiteList('dev'),
    credentials: true,
  },
})
export class NoticeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Map accountId -> list socketIds (1 account có thể mở nhiều tab / device)
  private accountSockets = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    try {
      const cookiesHeader = client.handshake.headers.cookie;
      if (!cookiesHeader) throw new Error('No cookie');

      const cookies = cookie.parse(cookiesHeader);
      const token = cookies.accessToken;
      if (!token) throw new Error('No accessToken');
      const payload = jwt.verify(token, environment().jwt.secret) as any;

      const accountId = payload.accountId;
      if (!accountId) throw new Error('Missing accountId in token');

      if (!this.accountSockets.has(accountId)) {
        this.accountSockets.set(accountId, new Set());
      }
      this.accountSockets.get(accountId)!.add(client.id);

      client.join(`account_${accountId}`);
    } catch (e: any) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    for (const [accountId, socketSet] of this.accountSockets.entries()) {
      if (socketSet.has(client.id)) {
        socketSet.delete(client.id);
        if (socketSet.size === 0) {
          this.accountSockets.delete(accountId);
        }
        break;
      }
    }
  }

  sendNoticeToAccount(notice: Notice) {
    this.server.to(`account_${notice.account}`).emit('notice', notice);
  }
}
