import type { Redis } from 'ioredis';
import { z } from 'zod';

export const REALTIME_EVENTS_CHANNEL = 'crm:realtime-events';

export const REALTIME_EVENTS = {
  LEAD_IMPORT_PROGRESS: 'lead-import:progress',
  NOTIFICATION_CREATED: 'notification:created',
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

const realtimeEventSchema = z.object({
  userId: z.string().uuid(),
  eventName: z.enum([REALTIME_EVENTS.LEAD_IMPORT_PROGRESS, REALTIME_EVENTS.NOTIFICATION_CREATED]),
  payload: z.record(z.unknown()),
});

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

export interface IRealtimePublisher {
  publishToUser(userId: string, eventName: RealtimeEventName, payload: Record<string, unknown>): Promise<void>;
}

export interface RealtimeEventDelivery {
  deliverToUser(userId: string, eventName: RealtimeEventName, payload: Record<string, unknown>): void;
}

export class RedisRealtimePublisher implements IRealtimePublisher {
  constructor(private readonly redisClient: Redis) {}

  async publishToUser(userId: string, eventName: RealtimeEventName, payload: Record<string, unknown>): Promise<void> {
    try {
      const realtimeEvent: RealtimeEvent = { userId, eventName, payload };
      await this.redisClient.publish(REALTIME_EVENTS_CHANNEL, JSON.stringify(realtimeEvent));
    } catch (error) {
      console.error(`Evento em tempo real "${eventName}" não publicado: ${(error as Error).message}`);
    }
  }
}

export class RedisRealtimeEventRelay {
  constructor(
    private readonly subscriberClient: Redis,
    private readonly delivery: RealtimeEventDelivery,
  ) {}

  async start(): Promise<void> {
    this.subscriberClient.on('message', (channel, rawEvent) => {
      if (channel === REALTIME_EVENTS_CHANNEL) this.relayEvent(rawEvent);
    });
    await this.subscriberClient.subscribe(REALTIME_EVENTS_CHANNEL);
  }

  async close(): Promise<void> {
    await this.subscriberClient.quit();
  }

  private relayEvent(rawEvent: string): void {
    try {
      const realtimeEvent = realtimeEventSchema.parse(JSON.parse(rawEvent));
      this.delivery.deliverToUser(realtimeEvent.userId, realtimeEvent.eventName, realtimeEvent.payload);
    } catch {
      console.error('Evento em tempo real inválido descartado');
    }
  }
}
