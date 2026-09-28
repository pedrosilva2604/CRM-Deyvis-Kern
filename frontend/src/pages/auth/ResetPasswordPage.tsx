import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { PASSWORD_MIN_LENGTH as MIN_LENGTH } from '@/config/auth';
import { api, apiErrorMessage } from '@/lib/api';

function readTokenFromUrlFragment() {
  return new URLSearchParams(window.location.hash.slice(1)).get('token');
}

function removeFragmentFromUrl() {
  if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
}

export function ResetPasswordPage() {
  const [token] = useState(readTokenFromUrlFragment);
  const navigate = useNavigate();

  useEffect(removeFragmentFromUrl, []);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const tooShort = password.length < MIN_LENGTH;
  const mismatch = password !== confirm;

  if (!token) {
    return (
      <AuthLayout title="Link inválido">
        <div className="space-y-5">
          <Alert variant="error">Este link de redefinição é inválido. Solicite um novo.</Alert>
          <Link to="/esqueci-senha" className="block text-center text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Solicitar novo link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (tooShort || mismatch) return;

    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      navigate('/login', { replace: true, state: { notice: 'Senha redefinida. Entre com a nova senha.' } });
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível redefinir a senha.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Criar nova senha" subtitle={`Use pelo menos ${MIN_LENGTH} caracteres.`}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <Alert variant="error">
            {error}{' '}
            <Link to="/esqueci-senha" className="font-semibold underline">
              Solicitar novo link
            </Link>
          </Alert>
        )}
        <TextField
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={touched && tooShort ? `A senha deve ter pelo menos ${MIN_LENGTH} caracteres` : undefined}
        />
        <TextField
          label="Confirmar nova senha"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={touched && mismatch ? 'As senhas não coincidem' : undefined}
        />
        <Button type="submit" loading={loading} className="w-full">
          {loading ? 'Salvando...' : 'Redefinir senha'}
        </Button>
      </form>
    </AuthLayout>
  );
}
