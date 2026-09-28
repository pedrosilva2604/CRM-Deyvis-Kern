import { create } from 'zustand';

export type Role = 'ADMIN' | 'AGENT';
export type Theme = 'LIGHT' | 'DARK';

export interface AuthUser {
  name: string;
  email: string;
  role: Role;
  theme: Theme;
}

export interface Session {
  expiresAt: string;
  user: AuthUser;
}

export type SessionStatus = 'checking' | 'authenticated' | 'anonymous';

interface AuthState {
  status: SessionStatus;
  user: AuthUser | null;
  expiresAt: string | null;
  notice: string | null;
  setSession: (session: Session) => void;
  setTheme: (theme: Theme) => void;
  clearSession: (notice?: string) => void;
}

export const useAuth = create<AuthState>()((set) => ({
  status: 'checking',
  user: null,
  expiresAt: null,
  notice: null,
  setSession: ({ user, expiresAt }) => set({ status: 'authenticated', user, expiresAt, notice: null }),
  setTheme: (theme) => set((state) => (state.user ? { user: { ...state.user, theme } } : state)),
  clearSession: (notice) => set({ status: 'anonymous', user: null, expiresAt: null, notice: notice ?? null }),
}));
