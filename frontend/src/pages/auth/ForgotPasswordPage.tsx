import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { api, apiErrorMessage } from '@/lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível enviar. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Verifique seu e-mail">
        <div className="space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <MailCheck size={24} />
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            Se <strong className="text-slate-900">{email}</strong> estiver cadastrado, você receberá um link para criar
            uma nova senha. O link tem validade limitada.
          </p>
          <p className="text-sm text-slate-500">Não recebeu? Confira a caixa de spam ou tente novamente.</p>
          <div className="flex flex-col gap-3">
            <Button type="button" variant="secondary" onClick={() => setSent(false)} className="w-full">
              Tentar outro e-mail
            </Button>
            <BackToLogin />
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Esqueceu sua senha?" subtitle="Informe seu e-mail e enviaremos um link para redefini-la.">
      <form onSubmit={handleSubmit} className="space-y-5">
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
        <Button type="submit" loading={loading} className="w-full">
          {loading ? 'Enviando...' : 'Enviar link'}
        </Button>
        <BackToLogin />
      </form>
    </AuthLayout>
  );
}

function BackToLogin() {
  return (
    <Link
      to="/login"
      className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      <ArrowLeft size={16} />
      Voltar para o login
    </Link>
  );
}
