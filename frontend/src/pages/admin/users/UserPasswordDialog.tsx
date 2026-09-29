import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TextField } from '@/components/ui/TextField';
import { useChangeUserPassword } from '@/hooks/useUsers';
import { apiErrorMessage, apiFieldErrors, type FieldErrors } from '@/lib/api';
import type { ManagedUser } from '@/types/user';

const PASSWORD_MIN_LENGTH = 8;

interface UserPasswordDialogProps {
  user: ManagedUser;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function UserPasswordDialog({ user, isSelf, onClose, onSaved }: UserPasswordDialogProps) {
  const changePassword = useChangeUserPassword();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');

  function validateLocally(): FieldErrors {
    if (password.length < PASSWORD_MIN_LENGTH) {
      return { password: `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres` };
    }
    if (password !== confirmation) return { confirmation: 'As senhas não conferem' };
    return {};
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const localErrors = validateLocally();
    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length > 0) return;

    try {
      await changePassword.mutateAsync({ userId: user.id, newPassword: password });
      onSaved(`Senha de ${user.name} alterada. As sessões abertas dele foram encerradas.`);
    } catch (err) {
      const errors = apiFieldErrors(err);
      setFieldErrors(errors);
      if (Object.keys(errors).length === 0) setError(apiErrorMessage(err, 'Não foi possível alterar a senha.'));
    }
  }

  return (
    <Modal
      title="Definir nova senha"
      description={`Nova senha de acesso para ${user.name}.`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert variant="error">{error}</Alert>}
        <Alert variant="warning">
          {isSelf
            ? 'Esta é a sua conta: ao salvar, você será desconectado e precisará entrar com a nova senha.'
            : 'Ao salvar, todas as sessões abertas deste usuário serão encerradas.'}
        </Alert>

        <TextField
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          placeholder={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres`}
          value={password}
          error={fieldErrors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <TextField
          label="Confirme a nova senha"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          error={fieldErrors.confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={changePassword.isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={changePassword.isPending}>
            Salvar nova senha
          </Button>
        </div>
      </form>
    </Modal>
  );
}
