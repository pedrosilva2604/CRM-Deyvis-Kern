import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { ISessionService } from '@/services/session.service';
import type { SessionCookie } from './session-cookie';

export class SocketGateway {
  private server?: Server;

  constructor(
    private readonly sessions: ISessionService,
    private readonly sessionCookie: SessionCookie,
    private readonly corsOrigin: string,
  ) {}

  attachToServer(httpServer: HttpServer) {
    this.server = new Server(httpServer, { cors: { origin: this.corsOrigin, credentials: true } });
    this.server.use(this.authenticateSocket);
  }

  get io() {
    if (!this.server) throw new Error('Socket.io não inicializado');
    return this.server;
  }

  async closeSocketsAndHttpServer(): Promise<void> {
    await new Promise<void>((resolve) => this.io.close(() => resolve()));
  }

  private authenticateSocket = async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token = this.sessionCookie.readSessionToken(socket.handshake.headers.cookie) ?? '';
      socket.data.user = await this.sessions.validateSession(token);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  };
}
