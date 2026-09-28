import type { Role } from '@prisma/client';
import type { ProfileOutput } from './user.model';

export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface SessionOutput {
  expiresAt: Date;
  user: ProfileOutput;
}

export interface LoginResult extends SessionOutput {
  token: string;
}

export interface TokenPayload {
  sid: string;
}

export interface AuthUser {
  id: string;
  role: Role;
  sessionId: string;
  sessionExpiresAt: Date;
}
