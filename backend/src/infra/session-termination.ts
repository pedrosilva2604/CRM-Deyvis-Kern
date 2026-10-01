export type SessionTermination = { endedSessionId: string } | { userWithAllSessionsEnded: string };

type SessionTerminationListener = (termination: SessionTermination) => void;

export interface ISessionTerminationNotifier {
  notifySessionEnded(sessionId: string): void;
  notifyAllUserSessionsEnded(userId: string): void;
}

export class SessionTerminationBroadcaster implements ISessionTerminationNotifier {
  private readonly listeners = new Set<SessionTerminationListener>();

  subscribe(listener: SessionTerminationListener): void {
    this.listeners.add(listener);
  }

  notifySessionEnded(sessionId: string): void {
    this.broadcast({ endedSessionId: sessionId });
  }

  notifyAllUserSessionsEnded(userId: string): void {
    this.broadcast({ userWithAllSessionsEnded: userId });
  }

  private broadcast(termination: SessionTermination): void {
    this.listeners.forEach((listener) => listener(termination));
  }
}
