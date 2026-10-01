import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { KeyRound, Pencil, Search, Trash2, UserCheck, UserPlus, UserX } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { useActivateUser, useDeactivateUser, useDeleteUser, useUsers } from '@/hooks/useUsers';
import { apiErrorMessage } from '@/lib/api';
import { endBrowserSession } from '@/lib/browserSession';
import { useAuth } from '@/stores/auth';
import { ROLE_LABELS, type ManagedUser } from '@/types/user';
import { UserFormDialog } from './UserFormDialog';
import { UserPasswordDialog } from './UserPasswordDialog';

type DialogState =
  | { kind: 'create' }
  | { kind: 'edit' | 'password' | 'deactivate' | 'delete'; user: ManagedUser }
  | null;

interface Notice {
  variant: 'success' | 'error';
  message: string;
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

function matchesSearch(user: ManagedUser, term: string) {
  return user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
}

export function UsersTab() {
  const currentUserEmail = useAuth((state) => state.user?.email);
  const { data: users = [], isPending, isError, refetch, isRefetching } = useUsers();
  const activateUser = useActivateUser();
  const deactivateUser = useDeactivateUser();
  const deleteUser = useDeleteUser();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmError, setConfirmError] = useState('');

  const searchTerm = search.trim().toLowerCase();
  const visibleUsers = useMemo(
    () => (searchTerm ? users.filter((user) => matchesSearch(user, searchTerm)) : users),
    [users, searchTerm],
  );
  const activeCount = users.filter((user) => user.active).length;

  const isSelf = (user: ManagedUser) => user.email === currentUserEmail;

  function openDialog(next: DialogState) {
    setNotice(null);
    setConfirmError('');
    setDialog(next);
  }

  function closeDialog() {
    setDialog(null);
    setConfirmError('');
  }

  function completeWith(message: string) {
    closeDialog();
    setNotice({ variant: 'success', message });
  }

  function handlePasswordSaved(user: ManagedUser, message: string) {
    if (isSelf(user)) return endBrowserSession('Sua senha foi alterada. Entre novamente com a nova senha.');
    completeWith(message);
  }

  async function handleActivate(user: ManagedUser) {
    setNotice(null);
    try {
      await activateUser.mutateAsync(user.id);
      setNotice({ variant: 'success', message: `${user.name} foi reativado e já pode entrar no CRM.` });
    } catch (err) {
      setNotice({ variant: 'error', message: apiErrorMessage(err, 'Não foi possível reativar o usuário.') });
    }
  }

  async function runConfirmedAction(action: () => Promise<unknown>, successMessage: string, fallbackError: string) {
    setConfirmError('');
    try {
      await action();
      completeWith(successMessage);
    } catch (err) {
      setConfirmError(apiErrorMessage(err, fallbackError));
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Buscar usuários"
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-500 dark:focus:ring-indigo-900/40"
          />
        </div>
        <div className="flex items-center gap-4">
          {!isPending && !isError && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {users.length} {users.length === 1 ? 'usuário' : 'usuários'} · {activeCount}{' '}
              {activeCount === 1 ? 'ativo' : 'ativos'}
            </p>
          )}
          <Button onClick={() => openDialog({ kind: 'create' })}>
            <UserPlus size={16} />
            Novo usuário
          </Button>
        </div>
      </div>

      {notice && <Alert variant={notice.variant}>{notice.message}</Alert>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {isPending && <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">Carregando usuários...</p>}

        {isError && (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300">Não foi possível carregar os usuários.</p>
            <Button variant="secondary" onClick={() => refetch()} loading={isRefetching}>
              Tentar novamente
            </Button>
          </div>
        )}

        {!isPending && !isError && visibleUsers.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum usuário encontrado para “{search.trim()}”.
          </p>
        )}

        {!isPending && !isError && visibleUsers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-5 py-3">Usuário</th>
                  <th scope="col" className="px-5 py-3">Perfil</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3">Cadastro</th>
                  <th scope="col" className="px-5 py-3 text-right">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleUsers.map((user) => {
                  const self = isSelf(user);
                  const activating = activateUser.isPending && activateUser.variables === user.id;
                  return (
                    <tr key={user.id} className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">
                        <div className={clsx('flex items-center gap-3', !user.active && 'opacity-60')}>
                          <span
                            aria-hidden="true"
                            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          >
                            {initialsOf(user.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                              <span className="truncate">{user.name}</span>
                              {self && <span className="text-xs font-normal text-slate-400">(você)</span>}
                            </div>
                            <div className="truncate text-slate-500 dark:text-slate-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={user.role === 'ADMIN' ? 'accent' : 'neutral'}>{ROLE_LABELS[user.role]}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={user.active ? 'success' : 'neutral'}>{user.active ? 'Ativo' : 'Inativo'}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-500 dark:text-slate-400">
                        {dateFormatter.format(new Date(user.createdAt))}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-0.5">
                          <IconButton icon={Pencil} label="Editar dados" onClick={() => openDialog({ kind: 'edit', user })} />
                          <IconButton
                            icon={KeyRound}
                            label="Definir nova senha"
                            onClick={() => openDialog({ kind: 'password', user })}
                          />
                          {user.active ? (
                            <IconButton
                              icon={UserX}
                              label={self ? 'Você não pode desativar a si mesmo' : 'Desativar usuário'}
                              disabled={self}
                              onClick={() => openDialog({ kind: 'deactivate', user })}
                            />
                          ) : (
                            <IconButton
                              icon={UserCheck}
                              label="Reativar usuário"
                              disabled={activating}
                              onClick={() => handleActivate(user)}
                            />
                          )}
                          <IconButton
                            icon={Trash2}
                            tone="danger"
                            label={self ? 'Você não pode excluir a si mesmo' : 'Excluir usuário'}
                            disabled={self}
                            onClick={() => openDialog({ kind: 'delete', user })}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialog?.kind === 'create' && <UserFormDialog onClose={closeDialog} onSaved={completeWith} />}

      {dialog?.kind === 'edit' && (
        <UserFormDialog user={dialog.user} isSelf={isSelf(dialog.user)} onClose={closeDialog} onSaved={completeWith} />
      )}

      {dialog?.kind === 'password' && (
        <UserPasswordDialog
          user={dialog.user}
          isSelf={isSelf(dialog.user)}
          onClose={closeDialog}
          onSaved={(message) => handlePasswordSaved(dialog.user, message)}
        />
      )}

      {dialog?.kind === 'deactivate' && (
        <ConfirmDialog
          title="Desativar usuário"
          confirmLabel="Desativar"
          variant="danger"
          loading={deactivateUser.isPending}
          error={confirmError}
          onClose={closeDialog}
          onConfirm={() =>
            runConfirmedAction(
              () => deactivateUser.mutateAsync(dialog.user.id),
              `${dialog.user.name} foi desativado e desconectado do CRM.`,
              'Não foi possível desativar o usuário.',
            )
          }
        >
          <strong className="font-semibold text-slate-900 dark:text-slate-100">{dialog.user.name}</strong> não
          conseguirá mais entrar no CRM e será desconectado agora. Os dados dele continuam salvos, e você pode
          reativá-lo quando quiser.
        </ConfirmDialog>
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title="Excluir usuário"
          confirmLabel="Excluir definitivamente"
          variant="danger"
          loading={deleteUser.isPending}
          error={confirmError}
          onClose={closeDialog}
          onConfirm={() =>
            runConfirmedAction(
              () => deleteUser.mutateAsync(dialog.user.id),
              `${dialog.user.name} foi excluído.`,
              'Não foi possível excluir o usuário.',
            )
          }
        >
          Esta ação não pode ser desfeita.{' '}
          <strong className="font-semibold text-slate-900 dark:text-slate-100">{dialog.user.name}</strong> será
          removido do CRM. Se a ideia é só impedir o acesso, prefira desativar.
        </ConfirmDialog>
      )}
    </div>
  );
}
