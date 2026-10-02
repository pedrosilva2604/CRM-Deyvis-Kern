export const LEAD_SUCCESS_MESSAGES = {
  CREATED: 'Lead criado',
  UPDATED: 'Lead atualizado',
  DELETED: 'Lead excluído',
  RESTORED: 'Lead restaurado',
} as const;

export const LEAD_IMPORT_SUCCESS_MESSAGES = {
  REQUESTED: 'Importação recebida',
  RETRY_REQUESTED: 'Importação retomada',
} as const;

export const PIPELINE_SUCCESS_MESSAGES = {
  CREATED: 'Funil criado',
  RENAMED: 'Funil renomeado',
  DELETED: 'Funil excluído',
  MEMBER_ADDED: 'Participante adicionado',
  MEMBER_REMOVED: 'Participante removido',
  STAGE_CREATED: 'Etapa criada',
  STAGE_UPDATED: 'Etapa atualizada',
  STAGES_REORDERED: 'Etapas reordenadas',
  STAGE_DELETED: 'Etapa excluída',
  CARD_ADDED: 'Lead adicionado ao funil',
  CARD_MOVED: 'Cartão movido',
  CARD_REMOVED: 'Lead retirado do funil',
} as const;

export const NOTIFICATION_SUCCESS_MESSAGES = {
  MARKED_AS_READ: 'Notificação marcada como lida',
  ALL_MARKED_AS_READ: 'Notificações marcadas como lidas',
} as const;

export const USER_SUCCESS_MESSAGES = {
  CREATED: 'Usuário criado',
  UPDATED: 'Usuário atualizado',
  ACTIVATED: 'Usuário ativado',
  DEACTIVATED: 'Usuário desativado',
  PASSWORD_CHANGED: 'Senha do usuário alterada',
  DELETED: 'Usuário excluído',
  RESTORED: 'Usuário restaurado',
} as const;

export const AUTH_SUCCESS_MESSAGES = {
  LOGGED_OUT: 'Sessão encerrada',
} as const;

export const PASSWORD_SUCCESS_MESSAGES = {
  RESET_LINK_SENT_IF_EMAIL_EXISTS: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.',
  PASSWORD_RESET: 'Senha redefinida com sucesso.',
} as const;

export const PROFILE_SUCCESS_MESSAGES = {
  THEME_UPDATED: 'Tema atualizado',
} as const;
