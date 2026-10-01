import type { IRealtimePublisher, RealtimeEventName } from '@/infra/realtime-events';

export type PublishedRealtimeEvent = {
  userId: string;
  eventName: RealtimeEventName;
  payload: Record<string, unknown>;
};

export class RecordingRealtimePublisher implements IRealtimePublisher {
  readonly publishedEvents: PublishedRealtimeEvent[] = [];

  async publishToUser(userId: string, eventName: RealtimeEventName, payload: Record<string, unknown>): Promise<void> {
    this.publishedEvents.push({ userId, eventName, payload });
  }
}
