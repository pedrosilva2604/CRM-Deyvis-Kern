import type { Role, Theme, User } from '@prisma/client';

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface UpdateThemeInput {
  theme: Theme;
}

export interface UpdateUserStatusInput {
  active: boolean;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: Role;
}

export type UserIdParams = {
  id: string;
};

export interface UpdateUserRequest {
  targetUserId: string;
  data: UpdateUserInput;
}

export interface UpdateUserStatusRequest {
  targetUserId: string;
  data: UpdateUserStatusInput;
}

export interface UpdateUserPasswordInput {
  password: string;
}

export interface UpdateUserPasswordRequest {
  targetUserId: string;
  data: UpdateUserPasswordInput;
}

export interface DeleteUserRequest {
  targetUserId: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export type UpdateUserData = UpdateUserInput;

export interface UserOutput {
  id: string;
  name: string;
  email: string;
  role: Role;
  theme: Theme;
}

export interface ProfileOutput {
  name: string;
  email: string;
  role: Role;
  theme: Theme;
}

export interface RegisteredUserOutput extends UserOutput {
  active: boolean;
  createdAt: Date;
}

export interface UserCredentials extends UserOutput {
  active: boolean;
  passwordHash: string;
}

export function toUserOutput(user: UserOutput): UserOutput {
  return { id: user.id, name: user.name, email: user.email, role: user.role, theme: user.theme };
}

export function toProfileOutput(user: ProfileOutput): ProfileOutput {
  return { name: user.name, email: user.email, role: user.role, theme: user.theme };
}

export function toUserCredentials(user: User): UserCredentials {
  return { ...toUserOutput(user), active: user.active, passwordHash: user.passwordHash };
}

export function toRegisteredUserOutput(user: User): RegisteredUserOutput {
  return { ...toUserOutput(user), active: user.active, createdAt: user.createdAt };
}
