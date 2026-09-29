import { api } from '@/lib/api';
import type { CreateUserPayload, ManagedUser, UpdateUserPayload } from '@/types/user';

export const usersApi = {
  async listUsers(): Promise<ManagedUser[]> {
    const response = await api.get<ManagedUser[]>('/users');
    return response.data;
  },

  async registerUser(newUser: CreateUserPayload): Promise<ManagedUser> {
    const response = await api.post<ManagedUser>('/users', newUser);
    return response.data;
  },

  async updateUser(userId: string, userChanges: UpdateUserPayload): Promise<ManagedUser> {
    const response = await api.patch<ManagedUser>(`/users/${userId}`, userChanges);
    return response.data;
  },

  async activateUser(userId: string): Promise<ManagedUser> {
    const response = await api.patch<ManagedUser>(`/users/${userId}/activate`);
    return response.data;
  },

  async deactivateUser(userId: string): Promise<ManagedUser> {
    const response = await api.patch<ManagedUser>(`/users/${userId}/deactivate`);
    return response.data;
  },

  async changeUserPassword(userId: string, newPassword: string): Promise<void> {
    await api.patch(`/users/${userId}/password`, { password: newPassword });
  },

  async deleteUser(userId: string): Promise<void> {
    await api.delete(`/users/${userId}`);
  },
};
