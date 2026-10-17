# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [0.3.0] - 17-10-2026

### Resumo Executivo

A versão 0.3.0 disponibiliza a API REST do processador de apostas, acompanhada de documentação interativa completa via Swagger/OpenAPI. Ela permite que provedores de jogos e sistemas de gestão criem carteiras de jogadores e realizem transações de apostas, ganhos, cancelamentos e estornos com segurança total. A nova interface impede cobranças duplicadas em conexões instáveis através de confirmação inteligente de transações já recebidas, oferece extrato detalhado para consulta de histórico, conta com auditoria contínua para certificar que o saldo dos jogadores esteja rigorosamente correto e disponibiliza um portal interativo no navegador para visualização e testes em tempo real de todos os recursos.

### ✨ Adicionado
- Documentação interativa Swagger / OpenAPI acessível via navegador em `/api/docs`.
- Endpoints de gerenciamento de carteiras:
  - `POST /wallets`: criação atômica de carteiras e lançamento contábil `OPENING` se houver saldo inicial.
  - `GET /wallets/:id`: consulta de dados cadastrais e saldo da carteira.
  - `GET /wallets/:id/ledger`: extrato de lançamentos com paginação por cursor (`base64` do `seq`).
  - `POST /wallets/:id/reconciliation`: auditoria contábil matemática comparando saldo e ledger.
- Endpoints de processamento de transações:
  - `POST /transactions`: processamento de apostas (`BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`) com lock pessimista e idempotência persistente.
  - Retornos HTTP de ciclo de vida: `201 Created` para nova transação, `200 OK` para replay idêntico, `202 Accepted` para referência pendente e `422 Unprocessable Entity` para rejeições de negócio.
  - `GET /transactions/:id`: consulta de transação por identificador interno.
  - `GET /transactions/external/:providerId/:externalId`: consulta de transação por chave externa do provedor.
- Camada de aplicação com 6 Casos de Uso integrados ao `UnitOfWork`.
- DTOs tipados com validação estrita via esquemas Zod.
- Filtro global de exceções (`HttpExceptionFilter`) padronizando o envelope `{ error: { code, message, retryable } }`.
- Suíte de 10 testes unitários de casos de uso e 15 testes de integração E2E da API HTTP.

### 🔄 Modificado
- `src/main.ts` atualizado para inicializar o `HttpModule`, registrar o filtro global de exceções e montar o Swagger em `/api/docs`.
- Controladores (`WalletsController`, `TransactionsController` e `HealthController`) enriquecidos com anotações OpenAPI.
- [README.md](./README.md) atualizado com link e instruções de acesso ao Swagger UI.
- `FailureCode` estendido com `WALLET_ALREADY_EXISTS` e `TRANSACTION_NOT_FOUND`.
- Adicionado pacote `@nestjs/swagger` às dependências.

### 🐛 Corrigido
- Reordenação da persistência no caso de uso para garantir que a transação de aposta seja inserida antes do registro de livro-razão correspondente, respeitando a chave estrangeira relacional.

### 🧪 Sugestões de Testes
- Acessar `http://localhost:3000/api/docs` e testar chamadas interativas pelo navegador.
- Executar `bun run test:pipeline` (41 testes unitários e 28 de integração contra banco real).
- Validar criação de carteira, aposta, replay idempotente e reconciliação contábil via API REST.

📄 [Notas detalhadas da versão](./docs/releases/00.03/00.03.00.md)

---

## [0.2.0] - 17-10-2026

### Resumo Executivo

A versão 0.2.0 introduz a camada de persistência financeira em banco de dados relacional com garantias rígidas de integridade. A partir desta versão, todas as operações de carteira contam com bloqueio seguro contra saldo negativo, histórico de extrato contábil imutável (à prova de adulterações ou exclusões acidentais) e mecanismo anti-duplicação que impede que apostas ou estornos sejam cobrados mais de uma vez, mesmo em situações de requisições simultâneas.

### ✨ Adicionado
- Camada de persistência relacional com MikroORM e PostgreSQL.
- Schemas relacionais desacoplados (`EntitySchema`) para `wallets`, `wager_transactions`, `wallet_ledger_entries`, `inbox_messages` e `outbox_messages`.
- Mappers bidirecionais preservando o isolamento do domínio puro através do método `rehydrate`.
- Triggers PostgreSQL de segurança em PL/pgSQL:
  - `trg_ledger_entries_immutable`: bloqueia qualquer tentativa de `UPDATE` ou `DELETE` no livro-razão.
  - `trg_wager_tx_terminal_state`: impede alterações em transações com status terminal (`PROCESSED`, `REJECTED`, `FAILED`).
- Índice único parcial `ux_single_reversal` para garantir que apostas sejam revertidas no máximo uma vez.
- Implementação de `UnitOfWork` com suporte a lock pessimista (`SELECT ... FOR UPDATE`) e `SKIP LOCKED`.
- Script nativo de migrações em Bun (`scripts/migrate.ts`) e comandos `bun run migration:up` / `bun run migration:down`.
- Workflow de automação de testes fail-fast (`.agent/workflows/run-tests.md`) e script `bun run test:pipeline`.
- Suíte de testes de integração com 13 cenários em banco de dados real (`test/integration/persistence.test.ts`).

### 🔄 Modificado
- Adicionados getters de leitura na entidade `WalletLedgerEntry` para acesso rápido a dados contábeis.
- [README.md](./README.md) atualizado com instruções de migrações de banco e acesso via clientes visuais (Postico, DBeaver).
- Incremento da versão do projeto para `0.2.0` no `package.json`.

### 🐛 Corrigido
- Resolução de incompatibilidade do CLI do MikroORM com versões legadas do Node.js através de runner nativo Bun.

### 🧪 Sugestões de Testes
- Executar `bun run test:pipeline` (todas as etapas devem passar em < 1s).
- Aplicar migrações com `bun run migration:up` e verificar tabelas no Postico 2.

📄 [Notas detalhadas da versão](./docs/releases/00.02/00.02.00.md)

---

## [0.1.0] - 17-10-2026

### Resumo Executivo

Primeira versão funcional do núcleo de processamento financeiro. Implementa toda a lógica de regras de apostas, controle de saldos de carteiras de jogadores e proteção contra arredondamentos incorretos em memória, servindo como a base de domínio do sistema.

### ✨ Adicionado
- Setup inicial do projeto em Bun com TypeScript estrito (`strict: true`, `noUncheckedIndexedAccess`).
- Value Object `Money` com aritmética decimal de alta precisão (escala 2) e proibição de tipo primitivo `number`.
- Regras de negócio de apostas `WageringPolicy` para operações `BET`, `WIN`, `LOSS`, `REFUND` e `ROLLBACK`.
- Máquina de estados de `WagerTransaction` e eventos de integração de domínio.
- Entidade imutável de livro-razão `WalletLedgerEntry`.
- Cálculo determinístico de hash canônico de idempotência (`payloadHash`).
- Script de segurança `lint-money.sh` contra vazamento de tipos numéricos.
- Infraestrutura base com Docker Compose (PostgreSQL 16 e LocalStack com filas SQS FIFO).
- Servidor NestJS inicial com verificação de integridade `/health/live`.
- Suíte inicial com 31 testes unitários cobrindo o domínio puro.
