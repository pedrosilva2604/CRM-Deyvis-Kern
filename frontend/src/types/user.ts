import type { Role, Theme } from '@/stores/auth';

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  theme: Theme;
  active: boolean;
  createdAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export type UpdateUserPayload = Partial<Pick<ManagedUser, 'name' | 'email' | 'role'>>;

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  AGENT: 'Atendente',
};
