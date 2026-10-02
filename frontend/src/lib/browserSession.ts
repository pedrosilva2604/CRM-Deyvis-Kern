import { disconnectSocket } from '@/lib/socket';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/stores/auth';

export function endBrowserSession(notice?: string): void {
  disconnectSocket();
  useAuth.getState().clearSession(notice);
  queryClient.clear();
}
