# CRM - Deyvis Kern

Monorepo (npm workspaces):

- `frontend/` — Vite + React + TypeScript, Tailwind v4, React Router, TanStack Query, Zustand, dnd-kit (kanban), Recharts (dashboard), Socket.io client
- `backend/` — Node.js + Express 5 + TypeScript, Prisma (PostgreSQL), JWT, Zod, Socket.io
- Integrações: Evolution API (WhatsApp Baileys) e WhatsApp Cloud API (oficial, para disparos com templates)

## Arquitetura do backend

Cada funcionalidade passa pelas camadas abaixo, sempre nessa direção: `routes → controllers → services → repositories`. Os `models` são usados por todas.

| Pasta | Responsabilidade |
| --- | --- |
| `src/models` | DTOs: interfaces de entrada e saída que trafegam pela API (sem validação) |
| `src/repositories` | Única camada que acessa o banco (Prisma) |
| `src/services` | Regra de negócio pura: não conhece Express nem Prisma |
| `src/controllers` | Lê a requisição já validada, chama o service e devolve resposta + status code |
| `src/routes` | Liga URL + middlewares (autenticação, validação, limite de tentativas) ao controller |
| `src/middlewares/schemas` | Schemas Zod de cada entrada, tipados pelo DTO correspondente e aplicados pelo `ValidationMiddleware` |

Apoio: `middlewares/` (autenticação, limite de tentativas, erros), `errors/` (erros com status HTTP), `integrations/` (Evolution API, WhatsApp Cloud API), `infra/` (infraestrutura: conexão do Redis, cookie de sessão, mailer, relógio, socket, contexto da requisição), `queues/` (filas do BullMQ) e `config/` (variáveis de ambiente, validadas na inicialização).

Todos os ids do banco são UUID nativo do PostgreSQL.

### Orientação a objetos e injeção de dependência

- Cada etapa é uma classe (`AuthController`, `AuthService`, `UserRepository`...), com métodos pequenos e uma responsabilidade.
- Toda dependência é recebida pelo construtor e tipada por uma **interface com prefixo `I`** (`IUserRepository`, `ISessionService`); a classe leva o nome do papel (`UserRepository`, `SessionService`) ou da tecnologia quando houver mais de uma possível (`Argon2PasswordHasher`, `JwtTokenService`).
- Um repository por entidade, com todo o CRUD dela; as saídas são sempre DTOs de `models/`, convertidos por funções de mapeamento (`toUserOutput`...).
- Composição em vez de herança: utilidades comuns (ex.: `RequestContextExtractor`) são injetadas nos controllers.
- [`src/container.ts`](backend/src/container.ts) é o único lugar que cria instâncias concretas. Nos testes, monte as classes passando implementações falsas das interfaces (inclusive o `Clock`, para controlar o tempo).
- Para um novo tipo de erro, basta estender `AppError`: o `ErrorMiddleware` não precisa mudar.

## Segurança

- **Rotas protegidas por padrão.** Só `GET /api/health` e as rotas de login e recuperação de senha são públicas; qualquer outra rota, inclusive as que forem criadas, exige sessão válida. Rotas administrativas exigem ainda o perfil `ADMIN`.
- **Token fora do alcance do JavaScript.** O JWT nunca aparece no corpo das respostas: vai em um cookie `HttpOnly` + `SameSite=Strict` (e `Secure` em produção, via `SESSION_COOKIE_SECURE=true`). O conteúdo do JWT é só o id da sessão, assinado com HS256.
- **Sessões revogáveis.** Cada login cria uma sessão no banco; o token só vale enquanto ela estiver ativa. Expira em `SESSION_TTL_HOURS`, é encerrada no logout e todas as sessões do usuário caem quando a senha é redefinida ou o usuário é desativado.
- **Senhas com Argon2id**, algoritmo recomendado pela OWASP: cada hash usa sal aleatório e exige memória (`ARGON2_MEMORY_KIB`), o que encarece ataques com GPU. Os parâmetros ficam no `.env` (mínimo OWASP: 19 MiB, 2 iterações, paralelismo 1). Login com e-mail inexistente também executa uma verificação Argon2, para o tempo de resposta não revelar quais e-mails estão cadastrados. Tokens de redefinição de senha são guardados apenas como hash SHA-256, valem por `PASSWORD_RESET_TTL_MINUTES`, são de uso único e o link usa fragmento (`#token=`), que não vai para servidores, logs nem cabeçalho `Referer`.
- **Erros genéricos.** Login responde sempre `Credenciais inválidas` (e-mail inexistente, senha errada, usuário inativo ou dados mal formatados); sessões recusadas respondem sempre `Sessão inválida ou expirada`; "esqueci minha senha" responde igual para e-mails cadastrados ou não; erros internos nunca expõem detalhes.
- **Limite de requisições em camadas**, configurável no `.env`: por IP em toda a API (`API_RATE_LIMIT`, protege contra inundação, inclusive nas rotas públicas), por usuário logado (`USER_API_RATE_LIMIT`, para vários atendentes atrás do mesmo IP não se bloquearem), por IP + e-mail no login e na recuperação de senha, e por usuário na importação de planilhas (`LEAD_IMPORT_RATE_LIMIT`).
- **Logout de verdade**: a sessão é revogada no banco, o cookie antigo passa a responder 401 em qualquer rota e as conexões de tempo real (Socket.IO) daquela sessão são derrubadas na hora; o mesmo vale ao desativar o usuário ou trocar a senha, e cada conexão cai sozinha quando a sessão expira.
- **Cabeçalhos de segurança**: Helmet na API; no nginx, `Content-Security-Policy` (só recursos da própria origem), `Strict-Transport-Security` (tempo em `WEB_HSTS_MAX_AGE`; deixe `0` enquanto o domínio não tiver HTTPS), `Permissions-Policy`, `X-Frame-Options` e `nosniff`. CORS restrito a `CORS_ORIGIN`, portas do Docker expostas apenas em `127.0.0.1`.
- **Containers sem root**: a API e o container de migrations rodam como `node`, e o nginx usa a imagem `nginx-unprivileged` (por isso `WEB_LISTEN_PORT` precisa ser 1024 ou maior). A senha do Redis vai por arquivo de configuração gerado dentro do container, não pela linha de comando, e o Evolution usa um usuário próprio do Postgres, sem acesso ao banco do CRM.
- **Nada sensível no repositório.** Chaves, senhas e URLs vêm dos arquivos `.env` (ignorados pelo git); os `.env.example` trazem só os nomes das variáveis. Arquivos `.sql`, dumps de banco e chaves/certificados também são ignorados; a única exceção são as migrations do Prisma (`backend/prisma/migrations/*/migration.sql`), que são versionadas porque o banco de produção é criado a partir delas.

**Respostas:** rotas de leitura (`GET`) devolvem os dados, sempre filtrados pelo DTO (nunca senha, hash ou campos internos). Rotas que alteram dados (criar, editar, excluir, ativar, desativar, trocar senha ou tema) respondem **só** `{ "message": "..." }` (ex.: `Lead criado`, `Usuário atualizado`), sem nenhum dado do registro; a tela busca os dados de novo pelo `GET`. Exclusões respondem `200` com a mensagem. Erros respondem `{ "error": "..." }`, e erros de validação trazem também `issues` por campo.

**Tratamento de erros:** controllers, services e repositories só lançam erros (`throw new NotFoundError(...)`); quem responde ao cliente é o `ErrorMiddleware`, no fim da cadeia do Express, usando o `statusCode` de cada classe de erro. Erros do banco são traduzidos num lugar só (`repositories/database-client.ts`): registro inexistente vira 404, telefone/e-mail duplicado vira 409 e banco fora do ar vira 503. Qualquer outra falha vira 500 com mensagem genérica, e o detalhe vai só para o log.

Além das respostas listadas em cada rota, **todas** podem responder `429` (limite de tentativas) e `500` (falha inesperada do servidor); as que consultam o banco podem responder `503` (banco indisponível); e as que exigem sessão respondem `401` sem uma sessão válida.

| Rota | Acesso | O que faz | Respostas |
| --- | --- | --- | --- |
| `GET /api/health` | pública | Verifica se a API está no ar | 200 |
| `POST /api/auth/login` | pública | Valida as credenciais e abre uma sessão (cookie) | 200, 400, 401 |
| `POST /api/auth/forgot-password` | pública | Envia o link de redefinição por e-mail | 200, 400 |
| `POST /api/auth/reset-password` | pública | Troca a senha e encerra todas as sessões do usuário | 200, 400 |
| `GET /api/auth/logged-user` | sessão | Confirma se a sessão ainda vale e retorna o usuário logado | 200 |
| `POST /api/auth/logout` | sessão | Encerra a sessão atual e apaga o cookie | 200 |
| `PATCH /api/profile/theme` | sessão | Salva o tema (`LIGHT` ou `DARK`) do usuário logado | 200, 400 |
| `GET /api/users` | ADMIN | Lista os usuários | 200, 403 |
| `POST /api/users` | ADMIN | Cadastra um usuário | 201, 400, 403, 409 |
| `PATCH /api/users/:id` | ADMIN | Edita nome, e-mail e/ou perfil de um usuário | 200, 400, 403, 404, 409 |
| `PATCH /api/users/:id/activate` | ADMIN | Reativa um usuário desativado | 200, 400, 403, 404 |
| `PATCH /api/users/:id/deactivate` | ADMIN | Desativa um usuário e encerra as sessões dele (não vale para si mesmo nem para o último admin ativo) | 200, 400, 403, 404 |
| `PATCH /api/users/:id/password` | ADMIN | Define uma nova senha para o usuário e encerra as sessões dele | 200, 400, 403, 404 |
| `DELETE /api/users/:id` | ADMIN | Exclui um usuário | 200, 400, 403, 404 |
| `GET /api/leads` | sessão | Lista leads com busca, filtros (`stageId`, `source`, `assignment` = id ou `unassigned`, `contactStatus`) e paginação (`page`, `pageSize` até 100). A busca aceita um telefone completo em qualquer formato (comparação exata) ou palavras inteiras de nome/e-mail, sem diferenciar acentos | 200, 400 |
| `GET /api/leads/indicators/total-leads` | sessão | `{ totalLeads }`: leads não excluídos | 200 |
| `GET /api/leads/indicators/new-leads` | sessão | `{ newLeadsInLastSevenDays }`: pela data de entrada, no fuso `APP_TIME_ZONE` | 200 |
| `GET /api/leads/indicators/unassigned-leads` | sessão | `{ unassignedLeads, shareOfBase }`: sem responsável e a fração da base (0 a 1) | 200 |
| `GET /api/leads/indicators/invalid-or-rejected-contacts` | sessão | `{ invalidOrRejectedContacts, shareOfBase }`: contato inválido ou spam | 200 |
| `GET /api/leads/indicators/complete-profiles` | sessão | `{ completeProfiles, shareOfBase }`: com nome, telefone e e-mail | 200 |
| `GET /api/leads/filter-options` | sessão | Funis e etapas, origens em uso e usuários ativos que podem ser responsáveis | 200 |
| `GET /api/leads/:leadId` | sessão | Detalhes de um lead | 200, 400, 404 |
| `POST /api/leads` | sessão | Cria um lead. Telefone e e-mail são únicos no CRM inteiro (409 se já existirem, inclusive em lead excluído) | 201, 400, 409 |
| `PATCH /api/leads/:leadId` | sessão | Edita um lead; só grava e audita os campos que realmente mudaram; trocar o telefone recalcula o país (`phoneCountry`) | 200, 400, 404, 409 |
| `DELETE /api/leads/:leadId` | ADMIN | Exclusão lógica (`deletedAt`): some das telas, mas o histórico fica e o telefone/e-mail continuam bloqueados | 200, 400, 403, 404 |
| `POST /api/leads/imports` | sessão | Recebe a planilha como `Content-Type: text/csv` (até `LEAD_IMPORT_MAX_FILE_BYTES` e `LEAD_IMPORT_MAX_ROWS` linhas), relê e revalida tudo no backend com as mesmas regras do `@crm/shared`, grava o pedido e as linhas válidas (sem duplicadas na planilha) e responde `{ message, importId }`. Os leads são criados depois, pela fila. Limite próprio de envios por usuário (`LEAD_IMPORT_RATE_LIMIT` por janela). Cada usuário tem no máximo **uma importação em andamento** (`PENDING` ou `PROCESSING`): o service recusa com 409 e um índice único parcial no banco garante a regra mesmo com envios simultâneos | 202, 400, 409, 413, 415, 429 |
| `GET /api/leads/imports/:importId` | sessão | Andamento da importação: `status` (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`) e as contagens (linhas, inválidas, repetidas na planilha, a importar, importadas, já existentes). Cada usuário vê só as próprias importações; o ADMIN vê todas | 200, 400, 404 |
| `GET /api/notifications` | sessão | As 30 notificações mais recentes do usuário logado e `unreadCount` (não lidas). Notificações novas também chegam em tempo real pelo Socket.IO (evento `notification:created`), e o progresso das importações pelo evento `lead-import:progress` | 200 |
| `PATCH /api/notifications/:notificationId/read` | sessão | Marca uma notificação do próprio usuário como lida (de outra pessoa responde 404) | 200, 400, 404 |
| `PATCH /api/notifications/read-all` | sessão | Marca todas as notificações do usuário como lidas. Notificações lidas há mais de `NOTIFICATION_READ_RETENTION_DAYS` dias são apagadas na manutenção diária | 200 |

## Rodando localmente

1. Copie os arquivos de exemplo e preencha os valores (gere segredos longos e aleatórios):
   - `.env.example` → `.env` (Postgres e Evolution usados pelo Docker)
   - `backend/.env.example` → `backend/.env`
   - `frontend/.env.example` → `frontend/.env`
2. Suba a infraestrutura: `docker compose up -d postgres redis mailpit` (e `evolution` quando for usar o WhatsApp).
3. `npm install`
4. `npm run db:migrate` (gera e aplica as migrations localmente) e `npm run db:seed` (cria o admin definido em `SEED_ADMIN_*` e um funil padrão).
5. `npm run dev`: API em http://localhost:3333/api, web em http://localhost:5173 e e-mails de desenvolvimento em http://localhost:8025.

## Scripts (raiz)

| Script | O que faz |
| --- | --- |
| `npm run dev` | Sobe a API, o worker das filas e o frontend juntos |
| `npm run build` | Build de produção dos dois |
| `npm run typecheck` | Checagem de tipos dos dois |
| `npm run test:unit` | Testes de unidade (Vitest) do `shared` e do backend: rápidos, sem banco nem Redis |
| `npm run test:integration` | Testes de integração do backend contra um Postgres real (banco `*_test` em `TEST_DATABASE_URL`) |
| `npm run test` | Todos os testes (Vitest) |

Como os testes são organizados e escritos: [docs/TESTES.md](docs/TESTES.md).
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma |

## Deploy (produção)

Cada parte roda como um serviço separado, com a sua própria imagem:

| Serviço | Receita | O que faz |
| --- | --- | --- |
| `web` | [`frontend/Dockerfile`](frontend/Dockerfile) | nginx servindo o frontend compilado e repassando `/api` e `/socket.io` para a API (mesma origem, sem CORS) |
| `api` | [`backend/Dockerfile`](backend/Dockerfile) (alvo `runtime`) | API Node, usuário sem privilégios, healthcheck e desligamento seguro ao receber SIGTERM |
| `migrate` | [`backend/Dockerfile`](backend/Dockerfile) (alvo `migrator`) | Roda `prisma migrate deploy` uma vez antes da API subir |
| `postgres`, `redis`, `evolution` | Imagens oficiais com versão fixa | Banco, Redis com senha e WhatsApp (Evolution) |

A explicação de cada linha dos Dockerfiles, do nginx e do compose está em [docs/DOCKER.md](docs/DOCKER.md).

[`docker-compose.prod.yml`](docker-compose.prod.yml) junta todos os serviços como referência. Só o `web` expõe porta; API, banco e Redis ficam em redes internas.

1. Preencha o `.env` da raiz (compose) e crie `backend/.env.production` com as chaves do `backend/.env.example`, usando `postgres` como host do `DATABASE_URL`, `TRUST_PROXY=1` (um proxy na frente: o nginx) e `SESSION_COOKIE_SECURE=true` quando houver HTTPS.
2. `docker compose -f docker-compose.prod.yml up -d --build`
3. Primeiro admin: `docker compose -f docker-compose.prod.yml run --rm migrate npx tsx prisma/seed.ts`

`TRUST_PROXY` diz à API quantos proxies confiáveis existem na frente dela, para ler o IP real do cliente (usado no limite de tentativas e na auditoria). Em dev fica `loopback`; atrás do nginx do `web`, `1`; se houver outro proxy na frente do nginx (plataforma de deploy, Cloudflare), aumente e ajuste o nginx para confiar nele.

## Padrão de commits

Os commits seguem o [Conventional Commits](https://www.conventionalcommits.org/pt-br/), validado automaticamente pelo Husky + commitlint a cada commit:

```
<tipo>(escopo opcional): <descrição em minúsculas, sem ponto final>
```

| Tipo | Quando usar |
| --- | --- |
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `chore` | Tarefas que não alteram o código de produção |
| `refactor` | Mudança no código sem alterar a funcionalidade final |
| `docs` | Somente documentação |
| `perf` | Melhoria de desempenho |
| `style` | Formatação do código, sem mudar comportamento |
| `test` | Adição ou correção de testes |
| `build` | Sistema de build ou dependências |
| `ci` | Arquivos e scripts de CI |
| `env` | Arquivos de configuração de ambiente |

Exemplos: `feat(backend): adiciona troca de senha pelo admin`, `fix(frontend): corrige tema no login`, `docs: atualiza tabela de rotas`.

- `npm run commit` abre um assistente (Commitizen) que monta a mensagem no padrão.
- Antes de cada commit rodam `npm run typecheck` e `npm run test:unit`; se houver erro de tipos ou um teste falhar, o commit é bloqueado.
- Commits com `Co-authored-by` são recusados.

## Licença

Código disponível publicamente apenas para visualização. Todos os direitos reservados: não é permitido copiar, usar, modificar ou distribuir sem autorização. Veja [LICENSE](LICENSE).
