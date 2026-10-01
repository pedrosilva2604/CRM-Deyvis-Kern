import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { endBrowserSession } from '@/lib/browserSession';
import { useAuth, type Session } from '@/stores/auth';

const VALIDATE_EVERY_MS = 60_000;
const EXPIRED_NOTICE = 'Sua sessão expirou. Entre novamente.';

export function useSessionGuard() {
  useServerSession();
  useLogoutWhenExpired();
}

function useServerSession() {
  const status = useAuth((s) => s.status);
  const setSession = useAuth((s) => s.setSession);

  const { data, isError } = useQuery({
    queryKey: ['logged-user'],
    queryFn: () => api.get<Session>('/auth/logged-user').then((r) => r.data),
    enabled: status !== 'anonymous',
    refetchInterval: VALIDATE_EVERY_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });

  useEffect(() => {
    if (data) setSession(data);
  }, [data, setSession]);

  useEffect(() => {
    if (isError && status === 'checking') endBrowserSession();
  }, [isError, status]);
}

function useLogoutWhenExpired() {
  const expiresAt = useAuth((s) => s.expiresAt);

  useEffect(() => {
    if (!expiresAt) return;
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) return endBrowserSession(EXPIRED_NOTICE);
    const timer = setTimeout(() => endBrowserSession(EXPIRED_NOTICE), remaining);
    return () => clearTimeout(timer);
  }, [expiresAt]);
}
