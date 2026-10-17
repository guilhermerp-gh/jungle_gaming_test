# 📄 Fase 2: Persistência & Banco de Dados (MikroORM + PostgreSQL)

> Especificação técnica detalhada da **Fase 2** do Desafio Técnico Jungle Gaming. Implementação da camada de persistência com MikroORM e PostgreSQL, cobrindo mapeamento relacional, migrations reversíveis, triggers de integridade, índices parciais, repositórios e Unit of Work com lock pessimista.

---

## 📌 Metadados

| Campo | Valor |
|-------|-------|
| **Versão** | v1.0 |
| **Data** | 17/10/2026 |
| **Autor** | Guilherme |
| **Status** | Pronto para Desenvolvimento |
| **Prioridade** | Alta |
| **Tipo** | Feature / Infraestrutura de Persistência |
| **Referência Mestre** | [docs/specs/2026-10-16-distributed-wagering-processor.md](file:///Users/guilherme/testes/jungle_gaming_test/docs/specs/2026-10-16-distributed-wagering-processor.md) |

---

## 📝 Resumo

Implementar a camada de persistência relacional do serviço utilizando **MikroORM** e **PostgreSQL**. A persistência deve manter o domínio puro (sem decorators de ORM nas entidades), mapeando schemas via `EntitySchema` e reconstruindo aggregates através de mappers (`rehydrate`). A migração inicial deve criar as tabelas com constraints de integridade, triggers de imutabilidade do ledger e proteção de estados terminais, além de implementar repositórios e `UnitOfWork` com suporte a lock pessimista (`SELECT ... FOR UPDATE` por carteira).

---

## 📦 Escopo

### ✅ Incluído
- Configuração do MikroORM (`mikro-orm.config.ts`) com PostgreSQL e parser de `NUMERIC` como string.
- Schemas relacionais com `EntitySchema` para as 5 tabelas:
  - `wallets`
  - `wager_transactions`
  - `wallet_ledger_entries`
  - `inbox_messages`
  - `outbox_messages`
- Mappers na infraestrutura para conversão bidirecional entre registros de banco e agregados/entidades de domínio.
- Migração inicial MikroORM versionada e reversível (`up`/`down`) contendo:
  - Enums PostgreSQL: `wager_kind`, `wager_status`, `ledger_direction`.
  - Constraints: `balance_amount >= 0`, `version >= 1`, integridade de referência e falha.
  - Triggers em PL/pgSQL:
    - Imutabilidade do ledger: disparar exceção em qualquer `UPDATE` ou `DELETE` em `wallet_ledger_entries`.
    - Transição de estados: impedir alteração de status a partir de estados terminais (`PROCESSED`, `REJECTED`, `FAILED`).
  - Índices parciais e únicos:
    - `ux_single_reversal` (reversão única por transação referenciada).
    - `ix_pending_ref` (lookup de pendências por `next_attempt_at`).
    - `ix_ref_lookup` (busca por `provider_id` e `reference_external_transaction_id`).
    - `ix_outbox_pending` (mensagens outbox não publicadas).
- Portas de aplicação em `src/application/ports/`:
  - `WalletRepository`, `WagerTransactionRepository`, `LedgerRepository`, `InboxRepository`, `OutboxRepository`, `UnitOfWork`.
- Implementação dos repositórios na infraestrutura conectando com `EntityManager`.
- Implementação de `UnitOfWork` com método `transactional(work)` e lock pessimista (`LockMode.PESSIMISTIC_WRITE`).
- Testes de integração de persistência (`test/integration/persistence.test.ts`).

### ❌ Fora do Escopo
- Casos de uso de aplicação e endpoints HTTP (Fase 3).
- Workers em background e consumidores SQS (Fases 5, 6 e 7).
- Rodar a migration no banco de dados sem permissão expressa do usuário.

---

## 🔄 Fluxo Principal

### Comportamento Atual
A aplicação possui apenas as classes de domínio puro na memória e o servidor HTTP básico. As pastas de persistência em `src/infrastructure/persistence/` estão vazias e não há comunicação com o PostgreSQL.

### Fluxo Proposto

#### 1. Execução de Operação Transacional com Lock Pessimista
1. O use case inicia uma transação através do `UnitOfWork.transactional(...)`.
2. O repositório busca a `Wallet` pelo `id` aplicando `LockMode.PESSIMISTIC_WRITE` (`SELECT ... FROM wallets WHERE id = :id FOR UPDATE`).
3. O domínio processa a operação e atualiza o estado em memória.
4. Os repositórios persistem as alterações na carteira, no ledger, na transação de aposta e no outbox.
5. O `UnitOfWork` commita a transação SQL, liberando o lock de linha no PostgreSQL.

#### 2. Rejeição por Triggers e Constraints no Banco
1. Se uma instrução SQL tentar executar `UPDATE` ou `DELETE` em `wallet_ledger_entries`, a trigger `trg_ledger_entries_immutable` interrompe a transação com erro `RAISE EXCEPTION`.
2. Se uma transação tentar mudar de `PROCESSED` para qualquer outro status, a trigger `trg_wager_tx_terminal_state` rejeita a alteração.
3. Se um `REFUND` tentar referenciar uma aposta que já foi revertida, o índice único parcial `ux_single_reversal` impede a duplicação no banco.

---

## 📐 Regras e Restrições

### Regras de Negócio e de Persistência
- **Dinheiro como String:** Colunas financeiras utilizam `NUMERIC(20,2)` no PostgreSQL e são obrigatoriamente tipadas como `string` no JavaScript/TypeScript (nunca `number`).
- **Isolamento do Domínio:** Nenhuma anotação ou decorator do MikroORM (`@Entity`, `@Property`) pode ser inserido nas classes de `src/domain/`.
- **Reversão Única:** Uma referência pode ser revertida no máximo uma vez no total (`REFUND` ou `ROLLBACK`), garantido por índice único parcial no banco.
- **Auditoria Imutável:** O ledger é estritamente append-only.
- **Lock por Linha:** O lock é escopado exclusivamente à linha da wallet envolvida (`FOR UPDATE`), nunca bloqueando tabelas inteiras.

---

## ✅ Critérios de Aceite

- [ ] Configuração do MikroORM (`mikro-orm.config.ts`) funcional com PostgreSQL e TypeScript estrito.
- [ ] Schemas `EntitySchema` criados para `wallets`, `wager_transactions`, `wallet_ledger_entries`, `inbox_messages` e `outbox_messages`.
- [ ] Mappers de infraestrutura reidratam entidades de domínio com suas propriedades privadas e tipos corretos (`Money`, `Date`, etc.).
- [ ] Arquivo de migração gerado contendo todas as tabelas, checks, triggers e índices parciais da spec mestre.
- [ ] Repositórios implementam as interfaces de `src/application/ports/`.
- [ ] `UnitOfWork` suporta transações aninhadas/gerenciadas com rollback automático em caso de exceção.
- [ ] Testes de integração comprovam o bloqueio de `UPDATE`/`DELETE` no ledger pela trigger.
- [ ] Testes de integração comprovam que `CHECK (balance_amount >= 0)` barra saldo negativo diretamente no banco.
- [ ] Nenhum decorator de persistência é adicionado em `src/domain/`.
- [ ] `bun run lint:money` e `bun run typecheck` passam sem nenhum erro.

---

## 🧩 Impacto Técnico

### Módulos / Camadas Impactadas
- **Application (`src/application/ports/`):** Definição das interfaces de repositório e Unit of Work.
- **Infrastructure (`src/infrastructure/persistence/`):**
  - `mikro-orm/`: Configuração e instâncias do ORM.
  - `schemas/`: Mapeamentos via `EntitySchema`.
  - `mappers/`: Tradução entre DB records e Agregados de Domínio.
  - `repositories/`: Implementação concreta dos repositórios.
  - `migrations/`: Arquivos de migração SQL versionados.
- **Testes (`test/integration/`):** Nova suíte de testes de persistência.

### Arquivos Prováveis
- `src/infrastructure/persistence/mikro-orm/mikro-orm.config.ts`
- `src/infrastructure/persistence/schemas/wallet.schema.ts`
- `src/infrastructure/persistence/schemas/wager-transaction.schema.ts`
- `src/infrastructure/persistence/schemas/wallet-ledger-entry.schema.ts`
- `src/infrastructure/persistence/schemas/inbox-message.schema.ts`
- `src/infrastructure/persistence/schemas/outbox-message.schema.ts`
- `src/infrastructure/persistence/mappers/wallet.mapper.ts`
- `src/infrastructure/persistence/mappers/wager-transaction.mapper.ts`
- `src/infrastructure/persistence/mappers/ledger.mapper.ts`
- `src/infrastructure/persistence/mappers/messaging.mapper.ts`
- `src/application/ports/unit-of-work.port.ts`
- `src/application/ports/repositories.port.ts`
- `src/infrastructure/persistence/repositories/mikro-orm-uow.ts`
- `src/infrastructure/persistence/repositories/mikro-orm-wallet.repository.ts`
- `src/infrastructure/persistence/repositories/mikro-orm-wager.repository.ts`
- `src/infrastructure/persistence/repositories/mikro-orm-ledger.repository.ts`
- `src/infrastructure/persistence/repositories/mikro-orm-messaging.repository.ts`
- `src/infrastructure/persistence/migrations/Migration20261017000001_InitialSchema.ts`
- `test/integration/persistence.test.ts`

---

## 🧭 Plano de Implementação

1. **Passo 1 — Definição de Portas:** Criar as interfaces em `src/application/ports/` (`WalletRepository`, `WagerTransactionRepository`, `LedgerRepository`, `InboxRepository`, `OutboxRepository`, `UnitOfWork`).
2. **Passo 2 — Configuração MikroORM:** Criar `mikro-orm.config.ts` lendo a URL de conexão do `loadConfig()`, com type parser seguro para `numeric` $\rightarrow$ string.
3. **Passo 3 — Schemas e Mappers:** Implementar os `EntitySchema` e mappers bidirecionais com método `rehydrate`.
4. **Passo 4 — Migration Inicial:** Criar o arquivo de migração TypeScript MikroORM contendo todo o DDL (tabelas, enums, checks, triggers e índices parciais).
5. **Passo 5 — Repositórios e UnitOfWork:** Implementar repositórios concretos utilizando o `EntityManager` do MikroORM com suporte a locks pessimistas (`LockMode.PESSIMISTIC_WRITE`).
6. **Passo 6 — Testes de Integração:** Escrever e validar os testes em `test/integration/persistence.test.ts` contra o PostgreSQL real.

### Decisões Técnicas
- **EntitySchema vs Decorators:** Usaremos `EntitySchema` para garantir que as classes de domínio (`Wallet`, `WagerTransaction`, etc.) não precisem de decorators nem dependências de infraestrutura.
- **Type Parser PostgreSQL:** O driver `pg` deve registrar `types.setTypeParser(1700, val => val)` para garantir que valores `NUMERIC` venham sempre como string pura.

---

## 🧪 Testes Esperados

- [ ] **Persistência de Wallet:** Salvar e buscar uma carteira mantendo o `Money` intacto e `version = 1`.
- [ ] **Lock Pessimista:** Verificar que `findById(id, { lock: 'PESSIMISTIC_WRITE' })` executa `SELECT ... FOR UPDATE`.
- [ ] **Trigger Imutabilidade Ledger:** Tentar executar `UPDATE` ou `DELETE` em `wallet_ledger_entries` e capturar a exceção lançada pela trigger.
- [ ] **Trigger Estado Terminal:** Tentar alterar o status de uma `WagerTransaction` com status `PROCESSED` e verificar rejeição.
- [ ] **Constraint Saldo Negativo:** Tentar forçar saldo negativo no banco e confirmar a violação do `CHECK (balance_amount >= 0)`.
- [ ] **Reversão Única:** Tentar persistir duas transações `REFUND` com status `PROCESSED` apontando para a mesma referência e verificar erro de chave única.

---

## 🤖 Instruções para IA

### Objetivo Operacional
> Implemente somente o que está dentro do escopo desta spec (Fase 2). Em caso de dúvida, pergunte antes de assumir.

### O que a IA deve entregar
- Portas, Schemas, Mappers, Repositórios e Unit of Work implementados.
- Arquivo de migração MikroORM criado com triggers e constraints.
- Testes de integração de persistência verdes.
- Resumo claro das alterações efetuadas.

### Observações específicas desta spec
- **NÃO FAZER COMMIT** sem permissão explícita do usuário.
- **NÃO RODAR MIGRATIONS** no banco de produção/desenvolvimento sem permissão explícita do usuário (os testes de integração devem criar e limpar o schema em banco de teste dedicado/docker).
- **Proibido usar `number` para campos monetários.** Validar sempre com `bun run lint:money`.

---

## 📁 Pós-execução da Spec

Quando o usuário pedir para executar esta spec, assim que todas as instruções forem concluídas e validadas com testes, mova o arquivo desta spec para a pasta `docs/executed/2026-10-17-phase-02-persistence.md`.
