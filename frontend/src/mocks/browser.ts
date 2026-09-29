import { setupWorker } from 'msw/browser';
import { leadsApiHandlers } from './leads/leadsApiHandlers';

export async function startFakeApiInBrowser(): Promise<void> {
  const fakeApiWorker = setupWorker(...leadsApiHandlers);
  await fakeApiWorker.start({ onUnhandledFrame: 'bypass', quiet: true });
}
