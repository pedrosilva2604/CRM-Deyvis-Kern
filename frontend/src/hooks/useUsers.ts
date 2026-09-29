import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/usersApi';
import type { CreateUserPayload, UpdateUserPayload } from '@/types/user';

const USERS_QUERY_KEY = ['users'] as const;

interface UserUpdate {
  userId: string;
  userChanges: UpdateUserPayload;
}

interface UserPasswordChange {
  userId: string;
  newPassword: string;
}

function useUsersMutation<TVariables, TResult>(sendChangeToApi: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendChangeToApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}

export function useUsers() {
  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: () => usersApi.listUsers(),
  });
}

export function useCreateUser() {
  return useUsersMutation((newUser: CreateUserPayload) => usersApi.registerUser(newUser));
}

export function useUpdateUser() {
  return useUsersMutation(({ userId, userChanges }: UserUpdate) => usersApi.updateUser(userId, userChanges));
}

export function useActivateUser() {
  return useUsersMutation((userId: string) => usersApi.activateUser(userId));
}

export function useDeactivateUser() {
  return useUsersMutation((userId: string) => usersApi.deactivateUser(userId));
}

export function useChangeUserPassword() {
  return useUsersMutation(({ userId, newPassword }: UserPasswordChange) =>
    usersApi.changeUserPassword(userId, newPassword),
  );
}

export function useDeleteUser() {
  return useUsersMutation((userId: string) => usersApi.deleteUser(userId));
}
