import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CreateUserPayload, ManagedUser, UpdateUserPayload } from '@/types/user';

const USERS_QUERY_KEY = ['users'] as const;

interface UpdateUserVariables {
  id: string;
  data: UpdateUserPayload;
}

interface ChangePasswordVariables {
  id: string;
  password: string;
}

function useUsersMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}

export function useUsers() {
  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: async () => (await api.get<ManagedUser[]>('/users')).data,
  });
}

export function useCreateUser() {
  return useUsersMutation(async (payload: CreateUserPayload) => (await api.post<ManagedUser>('/users', payload)).data);
}

export function useUpdateUser() {
  return useUsersMutation(
    async ({ id, data }: UpdateUserVariables) => (await api.patch<ManagedUser>(`/users/${id}`, data)).data,
  );
}

export function useActivateUser() {
  return useUsersMutation(async (id: string) => (await api.patch<ManagedUser>(`/users/${id}/activate`)).data);
}

export function useDeactivateUser() {
  return useUsersMutation(async (id: string) => (await api.patch<ManagedUser>(`/users/${id}/deactivate`)).data);
}

export function useChangeUserPassword() {
  return useUsersMutation(async ({ id, password }: ChangePasswordVariables) => {
    await api.patch(`/users/${id}/password`, { password });
  });
}

export function useDeleteUser() {
  return useUsersMutation(async (id: string) => {
    await api.delete(`/users/${id}`);
  });
}
