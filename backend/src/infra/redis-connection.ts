import { Redis } from 'ioredis';

const MINIMUM_RECONNECT_DELAY_MS = 1_000;
const MAXIMUM_RECONNECT_DELAY_MS = 20_000;

function waitBeforeReconnecting(reconnectAttempt: number): number {
  return Math.max(Math.min(Math.exp(reconnectAttempt), MAXIMUM_RECONNECT_DELAY_MS), MINIMUM_RECONNECT_DELAY_MS);
}

function logRedisConnectionError(error: Error): void {
  console.error(`Redis indisponível: ${error.message}`);
}

export function createQueueProducerRedisClient(redisUrl: string): Redis {
  const redisClient = new Redis(redisUrl, { enableOfflineQueue: false, retryStrategy: waitBeforeReconnecting });
  redisClient.on('error', logRedisConnectionError);
  return redisClient;
}

export function createWorkerRedisClient(redisUrl: string): Redis {
  const redisClient = new Redis(redisUrl, { maxRetriesPerRequest: null, retryStrategy: waitBeforeReconnecting });
  redisClient.on('error', logRedisConnectionError);
  return redisClient;
}
