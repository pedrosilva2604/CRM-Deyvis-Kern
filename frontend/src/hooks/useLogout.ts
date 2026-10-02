import { useState } from 'react';
import axios from 'axios';
import { api } from '@/lib/api';
import { endBrowserSession } from '@/lib/browserSession';

const LOGOUT_FAILED_MESSAGE = 'Não foi possível sair. Verifique a conexão e tente novamente.';

function sessionAlreadyInvalid(err: unknown) {
  return axios.isAxiosError(err) && err.response?.status === 401;
}

export function useLogout() {
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    setError('');
    setLoggingOut(true);
    try {
      await api.post('/auth/logout');
      endBrowserSession();
    } catch (err) {
      if (sessionAlreadyInvalid(err)) return endBrowserSession();
      setError(LOGOUT_FAILED_MESSAGE);
    } finally {
      setLoggingOut(false);
    }
  }

  return { logout, loggingOut, error };
}
