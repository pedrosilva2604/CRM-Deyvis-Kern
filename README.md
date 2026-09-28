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

Apoio: `middlewares/` (autenticação, limite de tentativas, erros), `errors/` (erros com status HTTP), `integrations/` (Evolution API, WhatsApp Cloud API), `lib/` (cookie de sessão, mailer, relógio, socket, contexto da requisição) e `config/` (variáveis de ambiente, validadas na inicialização).

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
- **Limite de tentativas** por IP (e por IP + e-mail no login e na recuperação), configurável no `.env`.
- **Cabeçalhos de segurança** via Helmet, CORS restrito a `CORS_ORIGIN`, portas do Docker expostas apenas em `127.0.0.1`.
- **Nada sensível no repositório.** Chaves, senhas e URLs vêm dos arquivos `.env` (ignorados pelo git); os `.env.example` trazem só os nomes das variáveis. Arquivos `.sql`, dumps de banco, migrations e chaves/certificados também são ignorados.

| Rota | Acesso | O que faz |
| --- | --- | --- |
| `GET /api/health` | pública | Verifica se a API está no ar |
| `POST /api/auth/login` | pública | Valida as credenciais e abre uma sessão (cookie) |
| `POST /api/auth/forgot-password` | pública | Envia o link de redefinição por e-mail |
| `POST /api/auth/reset-password` | pública | Troca a senha e encerra todas as sessões do usuário |
| `GET /api/auth/logged-user` | sessão | Confirma se a sessão ainda vale e retorna o usuário logado |
| `POST /api/auth/logout` | sessão | Encerra a sessão atual e apaga o cookie |
| `PATCH /api/profile/theme` | sessão | Salva o tema (`LIGHT` ou `DARK`) do usuário logado |
| `GET /api/users` | ADMIN | Lista os usuários |
| `POST /api/users` | ADMIN | Cadastra um usuário |
| `PATCH /api/users/:id` | ADMIN | Edita nome, e-mail e/ou perfil de um usuário |
| `PATCH /api/users/:id/status` | ADMIN | Ativa ou desativa um usuário (desativar encerra as sessões dele) |
| `PATCH /api/users/:id/password` | ADMIN | Define uma nova senha para o usuário e encerra as sessões dele |
| `DELETE /api/users/:id` | ADMIN | Exclui um usuário |

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
| `npm run dev` | Sobe backend e frontend juntos |
| `npm run build` | Build de produção dos dois |
| `npm run typecheck` | Checagem de tipos dos dois |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma |

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
- Antes de cada commit roda `npm run typecheck`; se houver erro de tipos, o commit é bloqueado.
- Commits com `Co-authored-by` são recusados.

## Licença

Código disponível publicamente apenas para visualização. Todos os direitos reservados: não é permitido copiar, usar, modificar ou distribuir sem autorização. Veja [LICENSE](LICENSE).
