import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { AuthUser } from '@/models/auth.model';
import type { ISessionService } from '@/services/session.service';
import type { RealtimeEventDelivery, RealtimeEventName } from './realtime-events';
import type { SessionCookie } from './session-cookie';
import type { SessionTermination, SessionTerminationBroadcaster } from './session-termination';

const LONGEST_TIMER_DELAY_MS = 2_147_483_647;

function sessionRoom(sessionId: string) {
  return `session:${sessionId}`;
}

function userRoom(userId: string) {
  return `user:${userId}`;
}

export class SocketGateway implements RealtimeEventDelivery {
  private server?: Server;

  constructor(
    private readonly sessions: ISessionService,
    private readonly sessionCookie: SessionCookie,
    private readonly sessionTerminations: SessionTerminationBroadcaster,
    private readonly corsOrigin: string,
  ) {}

  attachToServer(httpServer: HttpServer) {
    this.server = new Server(httpServer, { cors: { origin: this.corsOrigin, credentials: true } });
    this.server.use(this.authenticateSocket);
    this.server.on('connection', this.bindSocketToSession);
    this.sessionTerminations.subscribe(this.disconnectEndedSessions);
  }

  get io() {
    if (!this.server) throw new Error('Socket.io não inicializado');
    return this.server;
  }

  deliverToUser(userId: string, eventName: RealtimeEventName, payload: Record<string, unknown>): void {
    this.server?.to(userRoom(userId)).emit(eventName, payload);
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

  private bindSocketToSession = (socket: Socket) => {
    const loggedUser: AuthUser = socket.data.user;
    void socket.join([sessionRoom(loggedUser.sessionId), userRoom(loggedUser.id)]);
    const timeUntilSessionExpires = loggedUser.sessionExpiresAt.getTime() - Date.now();
    const sessionExpirationTimer = setTimeout(
      () => socket.disconnect(true),
      Math.min(timeUntilSessionExpires, LONGEST_TIMER_DELAY_MS),
    );
    sessionExpirationTimer.unref();
    socket.once('disconnect', () => clearTimeout(sessionExpirationTimer));
  };

  private disconnectEndedSessions = (termination: SessionTermination) => {
    if (!this.server) return;
    const endedRoom =
      'endedSessionId' in termination ? sessionRoom(termination.endedSessionId) : userRoom(termination.userWithAllSessionsEnded);
    this.server.in(endedRoom).disconnectSockets(true);
  };
}
