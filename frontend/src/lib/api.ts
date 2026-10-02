import axios from 'axios';
import { endBrowserSession } from '@/lib/browserSession';
import { useAuth } from '@/stores/auth';

const SESSION_EXPIRED_NOTICE = 'Sua sessão expirou. Entre novamente.';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401 && useAuth.getState().status === 'authenticated') {
      endBrowserSession(SESSION_EXPIRED_NOTICE);
    }
    return Promise.reject(err);
  },
);

export type FieldErrors = Partial<Record<string, string>>;

export function apiErrorMessage(err: unknown, fallback = 'Ocorreu um erro') {
  if (axios.isAxiosError(err)) return (err.response?.data as { error?: string })?.error ?? fallback;
  return fallback;
}

export function apiResponseField(err: unknown, field: string): string | null {
  if (!axios.isAxiosError(err)) return null;
  const value = (err.response?.data as Record<string, unknown> | undefined)?.[field];
  return typeof value === 'string' ? value : null;
}

export function apiFieldErrors(err: unknown): FieldErrors {
  if (!axios.isAxiosError(err)) return {};
  const issues = (err.response?.data as { issues?: Record<string, string[] | undefined> })?.issues ?? {};
  return Object.fromEntries(Object.entries(issues).map(([field, messages]) => [field, messages?.[0]]));
}
