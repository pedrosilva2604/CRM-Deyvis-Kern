import { api } from '@/lib/api';
import type { CreateUserPayload, ManagedUser, UpdateUserPayload } from '@/types/user';

export const usersApi = {
  async listUsers(): Promise<ManagedUser[]> {
    const response = await api.get<ManagedUser[]>('/users');
    return response.data;
  },

  async registerUser(newUser: CreateUserPayload): Promise<void> {
    await api.post('/users', newUser);
  },

  async updateUser(userId: string, userChanges: UpdateUserPayload): Promise<void> {
    await api.patch(`/users/${userId}`, userChanges);
  },

  async activateUser(userId: string): Promise<void> {
    await api.patch(`/users/${userId}/activate`);
  },

  async deactivateUser(userId: string): Promise<void> {
    await api.patch(`/users/${userId}/deactivate`);
  },

  async changeUserPassword(userId: string, newPassword: string): Promise<void> {
    await api.patch(`/users/${userId}/password`, { password: newPassword });
  },

  async deleteUser(userId: string): Promise<void> {
    await api.delete(`/users/${userId}`);
  },
};
