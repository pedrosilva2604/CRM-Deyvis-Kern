import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth, type Session } from '@/stores/auth';

interface LocationState {
  from?: { pathname: string };
  notice?: string;
}

export function LoginPage() {
  const { status, notice: sessionNotice, setSession } = useAuth();
  const navigate = useNavigate();
  const state = useLocation().state as LocationState | null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<Session>('/auth/login', { email, password });
      setSession(data);
      navigate(state?.from?.pathname ?? '/dashboard', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível entrar. Tente novamente.'));
    } finally {
      setPassword('');
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Entrar" subtitle="Acesse sua conta para continuar.">
      <form onSubmit={handleSubmit} className="space-y-5">
        {state?.notice && !error && <Alert variant="success">{state.notice}</Alert>}
        {sessionNotice && !error && <Alert variant="error">{sessionNotice}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}

        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="space-y-1.5">
          <TextField
            label="Senha"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="text-right">
            <Link to="/esqueci-senha" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Esqueci minha senha
            </Link>
          </div>
        </div>

        <Button type="submit" loading={loading} className="w-full">
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
    </AuthLayout>
  );
}
