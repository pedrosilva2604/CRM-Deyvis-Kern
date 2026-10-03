import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { useCreateUser, useRestoreUser, useUpdateUser } from '@/hooks/useUsers';
import { api, apiErrorMessage, apiFieldErrors, apiResponseField, type FieldErrors } from '@/lib/api';
import { useAuth, type Role, type Session } from '@/stores/auth';
import { ROLE_LABELS, type ManagedUser, type UpdateUserPayload } from '@/types/user';

const PASSWORD_MIN_LENGTH = 8;

const roleOptions = (Object.keys(ROLE_LABELS) as Role[]).map((role) => ({ value: role, label: ROLE_LABELS[role] }));

interface UserFormValues {
  name: string;
  email: string;
  role: Role;
}

interface UserFormDialogProps {
  user?: ManagedUser;
  isSelf?: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function collectChanges(user: ManagedUser, values: UserFormValues): UpdateUserPayload {
  const changes: UpdateUserPayload = {};
  const name = values.name.trim();
  const email = values.email.trim().toLowerCase();
  if (name !== user.name) changes.name = name;
  if (email !== user.email) changes.email = email;
  if (values.role !== user.role) changes.role = values.role;
  return changes;
}

export function UserFormDialog({ user, isSelf = false, onClose, onSaved }: UserFormDialogProps) {
  const isEditing = user !== undefined;
  const setSession = useAuth((state) => state.setSession);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const restoreUser = useRestoreUser();
  const [values, setValues] = useState<UserFormValues>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    role: user?.role ?? 'AGENT',
  });
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [deletedUserIdHoldingEmail, setDeletedUserIdHoldingEmail] = useState<string | null>(null);
  const saving = createUser.isPending || updateUser.isPending || restoreUser.isPending;

  function updateValue<K extends keyof UserFormValues>(field: K, value: UserFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function refreshOwnSession() {
    const { data } = await api.get<Session>('/auth/logged-user');
    setSession(data);
  }

  async function saveChanges(existingUser: ManagedUser) {
    const changes = collectChanges(existingUser, values);
    if (Object.keys(changes).length === 0) return onClose();
    await updateUser.mutateAsync({ userId: existingUser.id, userChanges: changes });
    if (isSelf) await refreshOwnSession();
    onSaved(`Dados de ${values.name.trim()} atualizados.`);
  }

  async function createNewUser() {
    await createUser.mutateAsync({ ...values, password });
    onSaved(`${values.name.trim()} foi cadastrado como ${ROLE_LABELS[values.role].toLowerCase()}.`);
  }

  function showFailure(err: unknown) {
    const errors = apiFieldErrors(err);
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) setError(apiErrorMessage(err, 'Não foi possível salvar o usuário.'));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setDeletedUserIdHoldingEmail(null);
    try {
      if (isEditing) await saveChanges(user);
      else await createNewUser();
    } catch (err) {
      showFailure(err);
      if (!isEditing) setDeletedUserIdHoldingEmail(apiResponseField(err, 'deletedUserId'));
    }
  }

  async function restoreDeletedUser(deletedUserId: string) {
    setError('');
    setFieldErrors({});
    try {
      await restoreUser.mutateAsync({ userId: deletedUserId, newPassword: password });
      onSaved('O usuário foi restaurado com o histórico dele e já pode entrar com a senha definida aqui.');
    } catch (err) {
      showFailure(err);
    }
  }

  return (
    <Modal
      title={isEditing ? 'Editar usuário' : 'Novo usuário'}
      description={isEditing ? 'Altere nome, e-mail ou perfil de acesso.' : 'O usuário entra no CRM com o e-mail e a senha definidos aqui.'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert variant="error">{error}</Alert>}
        {deletedUserIdHoldingEmail && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <span>Ele volta com o nome e o perfil que tinha, e entra com a senha digitada abaixo.</span>
            <Button type="button" variant="secondary" loading={restoreUser.isPending} onClick={() => restoreDeletedUser(deletedUserIdHoldingEmail)}>
              Restaurar usuário
            </Button>
          </div>
        )}

        <TextField
          label="Nome"
          autoFocus
          required
          maxLength={120}
          value={values.name}
          error={fieldErrors.name}
          onChange={(event) => updateValue('name', event.target.value)}
        />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="off"
          required
          value={values.email}
          error={fieldErrors.email}
          onChange={(event) => updateValue('email', event.target.value)}
        />
        {!isEditing && (
          <TextField
            label="Senha inicial"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            placeholder={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres`}
            value={password}
            error={fieldErrors.password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
        <SelectField
          label="Perfil de acesso"
          options={roleOptions}
          value={values.role}
          disabled={isSelf}
          hint={isSelf ? 'Você não pode alterar o seu próprio perfil.' : 'Administradores gerenciam usuários e veem os logs.'}
          error={fieldErrors.role}
          onChange={(event) => updateValue('role', event.target.value as Role)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {isEditing ? 'Salvar alterações' : 'Cadastrar usuário'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
