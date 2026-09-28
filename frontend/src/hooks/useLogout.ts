import { useState } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';
import { useAuth } from '@/stores/auth';

const LOGOUT_FAILED_MESSAGE = 'Não foi possível sair. Verifique a conexão e tente novamente.';

function sessionAlreadyInvalid(err: unknown) {
  return axios.isAxiosError(err) && err.response?.status === 401;
}

export function useLogout() {
  const clearSession = useAuth((s) => s.clearSession);
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  function finishLocally() {
    disconnectSocket();
    queryClient.clear();
    clearSession();
  }

  async function logout() {
    setError('');
    setLoggingOut(true);
    try {
      await api.post('/auth/logout');
      finishLocally();
    } catch (err) {
      if (sessionAlreadyInvalid(err)) return finishLocally();
      setError(LOGOUT_FAILED_MESSAGE);
    } finally {
      setLoggingOut(false);
    }
  }

  return { logout, loggingOut, error };
}
