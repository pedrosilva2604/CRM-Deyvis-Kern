export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Credenciais inválidas',
  INVALID_SESSION: 'Sessão inválida ou expirada. Entre novamente.',
  ACCESS_DENIED: 'Acesso não permitido',
} as const;

export const USER_ERRORS = {
  NOT_FOUND: 'Usuário não encontrado',
  EMAIL_IN_USE: 'Já existe um usuário com este e-mail',
  SELF_ACTION: 'Você não pode realizar esta ação no seu próprio usuário',
  LAST_ADMIN: 'O CRM precisa de pelo menos um administrador ativo',
} as const;

export const LEAD_ERRORS = {
  NOT_FOUND: 'Lead não encontrado',
  PHONE_IN_USE: 'Já existe um lead com este telefone',
  EMAIL_IN_USE: 'Já existe um lead com este e-mail',
  STAGE_NOT_FOUND: 'Etapa do funil não encontrada',
  ASSIGNEE_NOT_AVAILABLE: 'Responsável não encontrado ou desativado',
} as const;

export const PASSWORD_RESET_ERRORS = {
  INVALID_LINK: 'Link inválido ou expirado. Solicite uma nova redefinição de senha.',
} as const;

export const REQUEST_ERRORS = {
  VALIDATION_FAILED: 'Dados inválidos',
  INVALID_JSON: 'JSON inválido',
  PAYLOAD_TOO_LARGE: 'Requisição muito grande',
  RESOURCE_NOT_FOUND: 'Recurso não encontrado',
  TOO_MANY_REQUESTS: 'Muitas solicitações. Tente novamente em alguns minutos.',
  INTERNAL: 'Erro interno do servidor',
} as const;
