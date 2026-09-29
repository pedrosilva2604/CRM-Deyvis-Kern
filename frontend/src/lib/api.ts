import axios from 'axios';
import { useAuth } from '@/stores/auth';

const SESSION_EXPIRED_NOTICE = 'Sua sessão expirou. Entre novamente.';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401 && useAuth.getState().status === 'authenticated') {
      useAuth.getState().clearSession(SESSION_EXPIRED_NOTICE);
    }
    return Promise.reject(err);
  },
);

export type FieldErrors = Partial<Record<string, string>>;

export function apiErrorMessage(err: unknown, fallback = 'Ocorreu um erro') {
  if (axios.isAxiosError(err)) return (err.response?.data as { error?: string })?.error ?? fallback;
  return fallback;
}

export function apiFieldErrors(err: unknown): FieldErrors {
  if (!axios.isAxiosError(err)) return {};
  const issues = (err.response?.data as { issues?: Record<string, string[] | undefined> })?.issues ?? {};
  return Object.fromEntries(Object.entries(issues).map(([field, messages]) => [field, messages?.[0]]));
}
