import { MAXIMUM_STAGES_PER_PIPELINE } from '@/constants/pipeline-limits';

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Credenciais inválidas',
  INVALID_SESSION: 'Sessão inválida ou expirada. Entre novamente.',
  ACCESS_DENIED: 'Acesso não permitido',
} as const;

export const USER_ERRORS = {
  NOT_FOUND: 'Usuário não encontrado',
  EMAIL_IN_USE: 'Já existe um usuário com este e-mail',
  EMAIL_OF_DELETED_USER: 'Este e-mail é de um usuário excluído. Você pode restaurá-lo com o histórico dele.',
  EMAIL_OF_DELETED_USER_ON_EDIT: 'Este e-mail é de um usuário excluído',
  DELETED_USER_NOT_FOUND: 'Usuário excluído não encontrado',
  SELF_ACTION: 'Você não pode realizar esta ação no seu próprio usuário',
  LAST_ADMIN: 'O CRM precisa de pelo menos um administrador ativo',
} as const;

export const LEAD_ERRORS = {
  NOT_FOUND: 'Lead não encontrado',
  PHONE_IN_USE: 'Já existe um lead com este telefone',
  EMAIL_IN_USE: 'Já existe um lead com este e-mail',
  STAGE_NOT_FOUND: 'Etapa do funil não encontrada',
  ASSIGNEE_NOT_AVAILABLE: 'Responsável não encontrado ou desativado',
  PHONE_HELD_BY_DELETED_LEAD: 'Este telefone pertence a um lead excluído. Você pode restaurá-lo.',
  EMAIL_HELD_BY_DELETED_LEAD: 'Este e-mail pertence a um lead excluído. Você pode restaurá-lo.',
  PHONE_IN_USE_ASK_ADMIN: 'Este telefone já está em uso. Fale com um administrador.',
  EMAIL_IN_USE_ASK_ADMIN: 'Este e-mail já está em uso. Fale com um administrador.',
  DELETED_LEAD_NOT_FOUND: 'Lead excluído não encontrado',
  PHONE_OF_DELETED_LEAD_ON_EDIT: 'Este telefone pertence a um lead excluído e não pode ser usado em outro lead.',
  EMAIL_OF_DELETED_LEAD_ON_EDIT: 'Este e-mail pertence a um lead excluído e não pode ser usado em outro lead.',
} as const;

export const LEAD_IMPORT_ERRORS = {
  NOT_FOUND: 'Importação não encontrada',
  MISSING_FILE: 'Envie o arquivo CSV da planilha',
  NO_ROWS_TO_IMPORT: 'Nenhuma linha da planilha pode ser importada',
  ALREADY_RUNNING: 'Você já tem uma importação em andamento. Aguarde ela terminar para enviar outra planilha.',
  NOT_RETRYABLE: 'Só uma importação interrompida pode ser retomada',
  REQUESTER_HAS_RUNNING_IMPORT: 'Quem enviou esta planilha já tem outra importação em andamento. Tente de novo quando ela terminar.',
} as const;

export const PIPELINE_ERRORS = {
  NOT_FOUND: 'Funil não encontrado',
  ONLY_MANAGER: 'Só o dono do funil ou um administrador pode fazer isso',
  OWNER_NOT_AVAILABLE: 'O dono escolhido não existe ou está desativado',
  ONLY_ADMIN_CHOOSES_OWNER: 'Só um administrador pode criar funil para outra pessoa',
  MEMBER_NOT_AVAILABLE: 'Só é possível adicionar vendedores ativos',
  OWNER_ALREADY_HAS_ACCESS: 'O dono já tem acesso ao funil',
  MEMBER_ALREADY_ADDED: 'Esta pessoa já participa deste funil',
  MEMBER_NOT_FOUND: 'Esta pessoa não participa deste funil',
  STAGE_NOT_FOUND: 'Etapa não encontrada neste funil',
  LAST_STAGE: 'O funil precisa ter ao menos uma etapa',
  TOO_MANY_STAGES: `O funil pode ter no máximo ${MAXIMUM_STAGES_PER_PIPELINE} etapas`,
  RECEIVING_STAGE_INVALID: 'Escolha outra etapa deste funil para receber os cartões',
  CARD_ONLY_INTO_OPEN_STAGE: 'Adicione o lead numa etapa aberta. Para ganhar ou perder, arraste o cartão',
  IMPORT_ONLY_INTO_OPEN_STAGE: 'Importe os leads numa etapa aberta. Para ganhar ou perder, arraste o cartão',
  STAGE_HAS_CARDS_WITHOUT_WON_VALUE: 'Há cartões sem valor de venda nesta etapa. Mova-os antes de marcá-la como ganho',
  RECEIVING_STAGE_NEEDS_WON_VALUE: 'Há cartões sem valor de venda nesta etapa. Escolha uma etapa que não seja de ganho para recebê-los',
  STAGE_ORDER_INVALID: 'Envie todas as etapas do funil, cada uma uma única vez',
  CARD_NOT_FOUND: 'Cartão não encontrado neste funil',
  LEAD_ALREADY_IN_PIPELINE: 'Este lead já está neste funil',
  PREVIOUS_CARD_INVALID: 'O cartão de referência não está nesta etapa',
  WON_VALUE_REQUIRED: 'Informe o valor da venda para mover para uma etapa de ganho',
} as const;

export const NOTIFICATION_ERRORS = {
  NOT_FOUND: 'Notificação não encontrada',
} as const;

export const PASSWORD_RESET_ERRORS = {
  INVALID_LINK: 'Link inválido ou expirado. Solicite uma nova redefinição de senha.',
} as const;

export const REQUEST_ERRORS = {
  VALIDATION_FAILED: 'Dados inválidos',
  INVALID_JSON: 'JSON inválido',
  PAYLOAD_TOO_LARGE: 'Requisição muito grande',
  UNSUPPORTED_CONTENT: 'Formato ou codificação do conteúdo não suportados',
  INCOMPLETE_REQUEST: 'Requisição incompleta',
  RESOURCE_NOT_FOUND: 'Recurso não encontrado',
  RESOURCE_ALREADY_EXISTS: 'Registro já existe',
  TOO_MANY_REQUESTS: 'Muitas solicitações. Tente novamente em alguns minutos.',
  INTERNAL: 'Erro interno do servidor',
  SERVICE_UNAVAILABLE: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
} as const;
