# 🧠 Registro de Decisões Técnicas & Arquiteturais (ADR Compendium)

> **Projeto:** Distributed Wagering Processor  
> **Repositório:** `jungle_gaming_test`  
> **Padrão:** Architecture Decision Records (ADR) & Technical Rationale  
> **Escopo:** Documentação aprofundada de todas as decisões arquiteturais, contábeis, de concorrência e infraestrutura adotadas no sistema.

---

## 📑 Sumário

- [Visão Geral & Matriz de Decisões](#-visão-geral--matriz-de-decisões)
- [ADR-001: Runtime Bun & Engine JavaScriptCore vs. Node.js vs. Deno](#adr-001-runtime-bun--engine-javascriptcore-vs-nodejs-vs-deno)
- [ADR-002: Clean Architecture / Hexagonal com NestJS Desacoplado do Domínio](#adr-002-clean-architecture--hexagonal-com-nestjs-desacoplado-do-domínio)
- [ADR-003: Aritmética Financeira sem Ponto Flutuante (Value Object Money)](#adr-003-aritmética-financeira-sem-ponto-flutuante-value-object-money)
- [ADR-004: Modelo Contábil Híbrido: Saldo Materializado + Ledger Imutável com Triggers SQL](#adr-004-modelo-contábil-híbrido-saldo-materializado--ledger-imutável-com-triggers-sql)
- [ADR-005: Reconciliação Contábil em Tempo Real com Política de Não-Autocorreção](#adr-005-reconciliação-contábil-em-tempo-real-com-política-de-não-autocorreção)
- [ADR-006: Concorrência e Hot-Wallets: Lock Pessimista por Linha (`FOR UPDATE`)](#adr-006-concorrência-e-hot-wallets-lock-pessimista-por-linha-for-update)
- [ADR-007: Idempotência Persistente de Dois Níveis com Hashing Canônico e Dual-Compatibility](#adr-007-idempotência-persistente-de-dois-níveis-com-hashing-canônico-e-dual-compatibility)
- [ADR-008: Mensageria Assíncrona via Transactional Outbox Pattern com Lease e `SKIP LOCKED`](#adr-008-mensageria-assíncrona-via-transactional-outbox-pattern-com-lease-e-skip-locked)
- [ADR-009: Consumo SQS FIFO com Inbox Pattern e Deduplicação Atômica](#adr-009-consumo-sqs-fifo-com-inbox-pattern-e-deduplicação-atômica)
- [ADR-010: Tolerância a Eventos Fora de Ordem (`PENDING_REFERENCE`) com Fast-Path e Backoff com Jitter](#adr-010-tolerância-a-eventos-fora-de-ordem-pending_reference-com-fast-path-e-backoff-com-jitter)
- [ADR-011: Topologia de Binário Único com Especialização de Papéis (`APP_ROLE`)](#adr-011-topologia-de-binário-único-com-especialização-de-papéis-app_role)
- [ADR-012: Observabilidade: OpenMetrics/Prometheus, Logs Pino e Contexto Assíncrono (`AsyncLocalStorage`)](#adr-012-observabilidade-openmetricsprometheus-logs-pino-e-contexto-assíncrono-asynclocalstorage)
- [ADR-013: Conformidade de Contrato & Compatibilidade Dupla (Dual-Compatibility)](#adr-013-conformidade-de-contrato--compatibilidade-dupla-dual-compatibility)
- [ADR-014: Isolamento de Carga: Separação OLTP vs. OLAP para Produção de Alta Escala](#adr-014-isolamento-de-carga-separação-oltp-vs-olap-para-produção-de-alta-escala)
- [ADR-015: Pirâmide de Testes Fail-Fast com Multi-Instância Real e Testes de Carga](#adr-015-pirâmide-de-testes-fail-fast-com-multi-instância-real-e-testes-de-carga)

---

## 🧭 Visão Geral & Matriz de Decisões

A arquitetura do **Distributed Wagering Processor** foi orientada por um princípio basilar: **exatidão financeira absoluta sob alta concorrência distribuída**. Em plataformas de apostas (iGaming), inconsistências de centavos, corridas de saldo negativo (*double-spending*), eventos fora de ordem e duplicações por instabilidade de rede não são falhas operacionais toleráveis; são prejuízos financeiros diretos e quebras de conformidade regulatória.

A tabela a seguir sumariza as decisões estruturais documentadas neste compêndio:

| ADR | Dimensão | Decisão Adotada | Principal Alternativa Descartada | Racional Principal |
| :---: | :--- | :--- | :--- | :--- |
| **001** | Runtime | **Bun (v1.4+)** | Node.js v20/v22 LTS | Inicialização sub-milissegundo para processos filhos, TS nativo e performance de I/O. |
| **002** | Arquitetura | **Clean Architecture / Hexagonal** | Monólito MVC acoplado ao NestJS | Domínio 100% puro e agnóstico de frameworks, testável em memória e isolado de ORMs. |
| **003** | Tipagem Financeira | **Value Object `Money` (decimal.js + string)** | `number` (IEEE 754 float) / Inteiro em centavos | Eliminação de erros de ponto flutuante e enforcement estático via AST Linting. |
| **004** | Modelo Contábil | **Saldo Materializado + Ledger Imutável + Triggers SQL** | Event Sourcing puro / CRUD simples | Leituras $O(1)$ de saldo com trilha de auditoria append-only à prova de manipulação física. |
| **005** | Reconciliação | **Auditoria Matemática sem Autocorreção** | Auto-ajuste silencioso de saldo | Qualquer divergência é anomalia contábil grave que exige investigação humana, não mascaramento. |
| **006** | Concorrência | **Lock Pessimista por Linha (`FOR UPDATE`)** | Lock Otimista (`version`) / Redis Redlock | Evita *retry storms* sob hot-wallets e dispensa sistemas de consenso distribuído externos. |
| **007** | Idempotência | **Dois Níveis Persistentes + Hash SHA-256 Canônico** | Cache volátil em Redis | Proteção contra retentativas de rede e provedores reenviando chaves divergentes. |
| **008** | Mensageria Egress | **Transactional Outbox com Lease e `SKIP LOCKED`** | Publicação direta no broker (Dual-Write) | Atomicidade garantida entre mutação contábil e evento; entrega At-Least-Once sem perdas. |
| **009** | Mensageria Ingress | **SQS FIFO com Inbox Pattern Dedup e DLQ** | SQS Standard sem Inbox | Ordenação por `walletId` e absorção de mensagens duplicadas após crashes de rede. |
| **010** | Fora de Ordem | **`PENDING_REFERENCE` + Fast-Path + Backoff Jitter** | Rejeição síncrona imediata (404/422) | Tolerância a chegadas invertidas (`WIN`/`REFUND` antes da `BET`) sem perda de apostas. |
| **011** | Deployabilidade | **Binário Único Especializado por `APP_ROLE`** | Microsserviços em repositórios separados | Escalonamento horizontal assimétrico sem complexidade de múltiplos repositórios. |
| **012** | Telemetria | **Prometheus (`prom-client`) + Pino + `AsyncLocalStorage`** | Logs soltos sem correlação | Rastreabilidade distribuída de ponta a ponta sem poluir assinaturas de métodos. |
| **013** | Contratos | **Dual-Compatibility & Roteamento Híbrido** | Forçar migração de clientes legados | 100% de conformidade com a especificação Jungle Gaming sem quebrar clientes existentes. |
| **014** | Escala Futura | **Separação OLTP vs. OLAP (Read Replicas & CQRS)** | Consultas analíticas no nó master | Proteção de CPU, locks e buffer pool do banco relacional transacional primário. |
| **015** | Qualidade | **Pirâmide Fail-Fast com Processos Reais (`Bun.spawn`)** | Mocks de banco e de rede em testes E2E | Validação fidedigna de concorrência e recuperação de crashes idêntica ao ambiente produtivo. |

---

## ADR-001: Runtime Bun & Engine JavaScriptCore vs. Node.js vs. Deno

### Contexto
O Distributed Wagering Processor requer alta taxa de transferência de I/O assíncrono, baixo consumo de memória por instância e, crucialmente, inicialização instantânea de novos processos para viabilizar testes de alta fidelidade multi-instância (onde 3 processos independentes são inicializados dinamicamente, derrubados via `SIGKILL` e substituídos em milissegundos).

### Alternativas Avaliadas
1. **Node.js (v20 / v22 LTS):** É o padrão consagrado da indústria. Porém, exige ferramentas de build ou transpiladores em tempo de execução (`tsx`, `ts-node`, esbuild) para rodar TypeScript puro, consome significativamente mais memória em repouso por instância (~60-90 MB vs ~25 MB do Bun) e possui tempo de inicialização de processos filhos (`child_process.fork`) na casa de 150 a 300 ms.
2. **Deno:** Excelente suporte nativo a TypeScript e modelo de permissões robusto. No entanto, possui atritos de interoperabilidade com o ecossistema npm corporativo (especialmente com dependências complexas como NestJS v12 e MikroORM v7).
3. **Bun (v1.4+):** Engine JavaScriptCore (Apple WebKit), execução nativa de TypeScript com type-stripping instantâneo, gerenciador de pacotes ultrarrápido com lockfile determinístico (`bun.lock`) e primitivas de sistema como `Bun.spawn` capazes de subir processos em menos de 15 ms.

### Decisão
Adotou-se o **Bun** como runtime oficial de desenvolvimento, testes e execução do binário (`APP_ROLE=all bun src/main.ts`). Para ambientes conteinerizados, o container utiliza imagem base oficial `oven/bun:1.2-alpine` em multi-stage build.

### Justificativa Técnica
- **Subida de nós para testes distribuídos:** Os testes de concorrência distribuída ([`test/multi-instance/multi-instance-recovery.test.ts`](file:///Users/guilherme/testes/jungle_gaming_test/test/multi-instance/multi-instance-recovery.test.ts)) iniciam e terminam múltiplos nós HTTP reais em portas aleatórias. No Bun, a suíte inteira de multi-instância roda em ~11 segundos. No Node.js, a mesma suíte ultrapassaria 40 segundos devido ao overhead de compilação TS e warm-up da V8.
- **Eficiência de Conexões:** O pooling de conexões do driver `pg` nativo e HTTP server do Bun entregam latências medianas de 20 a 29 ms sob carga de 800+ requisições por segundo.

### Trade-offs & Mitigações
- *Trade-off:* O ecossistema Bun é mais jovem que a V8/Node.js, podendo conter incompatibilidades pontuais com C++ addons legados.
- *Mitigação:* O projeto utiliza exclusivamente pacotes JavaScript/TypeScript puros (NestJS, MikroORM, decimal.js, AWS SDK v3, prom-client, pino) e valida 100% da suíte dentro de containers Linux Docker através do comando `bun run docker:test`.

---

## ADR-002: Clean Architecture / Hexagonal com NestJS Desacoplado do Domínio

### Contexto
Frameworks corporativos em TypeScript (como NestJS) tendem a incentivar o uso indiscriminado de decorators (`@Entity`, `@Injectable`, `@Column`) diretamente nas classes de domínio. Isso gera acoplamento umbilical entre a regra de negócio financeira e o framework, impossibilitando a troca de ORM, dificultando testes unitários puros e contaminando a integridade do domínio com detalhes de transporte e infraestrutura.

### Alternativas Avaliadas
1. **Padrão MVC Tradicional / Active Record:** Entidades com decorators do ORM que salvam a si próprias (`wallet.save()`). Rejeitado: viola gravemente a separação de responsabilidades e impossibilita isolamento contábil.
2. **Fastify/Express Raw sem Framework:** Arquitetura minimalista construída manualmente. Rejeitado: exige reescrever injeção de dependências, filtros globais, interceptors e adaptadores de documentação OpenAPI/Swagger.
3. **Clean Architecture / Hexagonal com NestJS Restrito à Camada Externa (Ports & Adapters):**
   - O Domínio (`src/domain/`) não contém nenhuma dependência externa, decorators do NestJS ou tipos do MikroORM.
   - A Aplicação (`src/application/`) define os casos de uso e as portas de abstração (interfaces TypeScript de Repositórios, UnitOfWork e MessagePublishers).
   - A Infraestrutura (`src/infrastructure/`) implementa os adaptadores (MikroORM, PostgreSQL, SQS, Pino).
   - As Interfaces (`src/interfaces/`) gerenciam a entrada de dados (Controllers HTTP e Workers SQS).

```
src/
├── domain/                  # Pura lógica de negócio (Zero deps, testável sem IO)
│   ├── money/               # Value Object Money
│   ├── wallet/              # Agregado Wallet
│   ├── wagering/            # Entidade WagerTransaction, WageringPolicy
│   ├── ledger/              # Entidade WalletLedgerEntry (Imutável)
│   ├── messaging/           # Entidades InboxMessage e OutboxMessage
│   └── events/              # Eventos de domínio
├── application/             # Casos de uso e portas de entrada/saída
│   ├── use-cases/           # ProcessWagerTransaction, Reconcile, Outbox, Resolver
│   └── ports/               # WalletRepositoryPort, UnitOfWorkPort, MessagePublisherPort
├── infrastructure/          # Adaptadores concretos
│   ├── persistence/         # MikroORM, Schema SQL, Migrations, Mappers
│   └── sqs/                 # AWS SDK v3 SQS Client
└── interfaces/              # Adaptadores de entrada (Drivers)
    ├── http/                # Controllers NestJS, DTOs, Swagger
    └── workers/             # Consumidor SQS FIFO, Outbox Publisher, Resolver
```

### Decisão
Adotou-se **Clean Architecture Hexagonal estrita**, utilizando o NestJS exclusivamente como container de Injeção de Dependências e orquestrador de transporte nas camadas externas.

### Justificativa Técnica
- **Testabilidade de Domínio em Microssegundos:** Casos de uso e políticas de aposta ([`src/domain/wagering/wagering.policy.ts`](file:///Users/guilherme/testes/jungle_gaming_test/src/domain/wagering/wagering.policy.ts)) são testados via testes unitários puros com dublês de teste em memória, executando 84 testes em ~600 ms sem necessidade de subir container ou banco de dados.
- **Portabilidade Total:** O mapeamento entre registros relacionais do banco e o agregado de domínio é explicitamente realizado por Mappers de Infraestrutura ([`src/infrastructure/persistence/mikro-orm/mappers/`](file:///Users/guilherme/testes/jungle_gaming_test/src/infrastructure/persistence/mikro-orm/mappers/)), isolando mudanças de schema SQL das regras de negócio.

---

## ADR-003: Aritmética Financeira sem Ponto Flutuante (Value Object Money)

### Contexto
O JavaScript representa números internamente no padrão IEEE 754 (ponto flutuante de precisão dupla de 64 bits). Esse padrão não consegue representar com exatidão frações decimais em base 2. Cálculos corriqueiros como `0.10 + 0.20` resultam em `0.30000000000000004`. Em um motor de apostas que processa dezenas de milhões de transações, o acúmulo de erros de arredondamento em float gera "centavos fantasmas", quebra reconciliações contábeis e causa vulnerabilidades de exploração de saldo.

### Alternativas Avaliadas
1. **Tipo primitivo `number` com `toFixed(2)`:** Rejeitado. `toFixed()` executa arredondamentos arbitrários e converte para string de forma inconsistente, sem resolver perdas de precisão em operações intermediárias.
2. **Inteiro em Centavos (Cent Amount com `number` ou `BigInt`):** Armazenar R$ 10,50 como o inteiro `1050`. Embora evite ponto flutuante, é propenso a falhas humanas de conversão (esquecer de multiplicar ou dividir por 100), além de não carregar a moeda (ISO 4217) acoplada ao montante.
3. **Value Object `Money` com `decimal.js` e Validação Estática via AST Linting:**
   - Criação da classe imutável `Money` ([`src/domain/money/money.ts`](file:///Users/guilherme/testes/jungle_gaming_test/src/domain/money/money.ts)) que encapsula o valor monetário como string estrita de 2 casas decimais (`^\d+\.\d{2}$`) e o código da moeda de 3 letras maiúsculas (ex.: `BRL`).
   - Operações matemáticas delegadas à biblioteca `decimal.js` configurada com precisão arbitrária e arredondamento determinístico.
   - Script de linting estático ([`scripts/lint-money.sh`](file:///Users/guilherme/testes/jungle_gaming_test/scripts/lint-money.sh)) executado na pipeline de build, bloqueando qualquer ocorrência de `parseFloat`, divisão solta de `number` ou conversões inseguras em arquivos de negócio.

### Decisão
Implementou-se o **Value Object `Money` baseado em representação imutável de strings e `decimal.js`**, persistido no PostgreSQL como tipo relacional exato `NUMERIC(20,2)` e moeda `CHAR(3)`.

### Detalhes de Implementação & Proteção no Driver SQL
Para impedir que o driver PostgreSQL do Node/Bun (`pg`) faça coerção automática de colunas `NUMERIC` para tipos primitivos `number` do JavaScript ao ler do banco, o projeto sobrescreve o parser global do `pg` no arquivo de configuração do MikroORM:

```typescript
// src/infrastructure/persistence/mikro-orm/mikro-orm.config.ts
import { types } from 'pg';
// Força o PostgreSQL a retornar tipos NUMERIC (OID 1700) como string pura
types.setTypeParser(1700, (val: string) => val);
```

### Justificativa Técnica
- **Aritmética Exata:** Operações de `add` e `subtract` garantem que `0.10 + 0.20 = 0.30` sem desvios infinitesimais.
- **Fail-Fast na Borda:** A factory `Money.from()` rejeita instantaneamente valores malformados (`"1.234"`, `"-5.00"`, `"NaN"`, `"1e5"`, `"1,00"`), impedindo que dados corrompidos ingressem na aplicação.

---

## ADR-004: Modelo Contábil Híbrido: Saldo Materializado + Ledger Imutável com Triggers SQL

### Contexto
Como garantir a integridade absoluta do saldo de um jogador e, simultaneamente, manter uma trilha de auditoria contábil legalmente auditável com histórico completo de cada centavo movimentado, sem degradar a performance de leitura de saldo para $O(N)$?

### Alternativas Avaliadas
1. **CRUD Tradicional Mutável (Apenas tabela `wallets`):**
   - Atualiza `balance_amount` a cada aposta.
   - *Problema:* Zero auditoria. Se o saldo for corrompido, é impossível rastrear qual transação causou o erro. Proibido por regulamentações de jogos de azar.
2. **Event Sourcing Puro (Apenas tabela de eventos/ledger):**
   - O saldo da carteira não é persistido; é recalculado a quente somando todos os créditos e subtraindo todos os débitos da história do jogador.
   - *Problema:* Jogadores frequentes acumulam dezenas de milhares de apostas. A leitura do saldo sob concorrência exige varredura de milhares de linhas ou snapshots intermediários complexos, gerando alta latência sob *hot-wallets*.
3. **Modelo Híbrido (Saldo Materializado + Livro-Razão Imutável Append-Only):**
   - A tabela `wallets` armazena o saldo materializado atual para leituras e travas transacionais $O(1)$.
   - A tabela `wallet_ledger_entries` armazena o histórico imutável de todas as movimentações financeiras (`OPENING`, `DEPOSIT`, `BET`, `WIN`, `REFUND`, `ROLLBACK`).
   - A imutabilidade física é imposta pelo motor do PostgreSQL através de **Triggers SQL** que abortam qualquer tentativa de `UPDATE` ou `DELETE`.

### Decisão
Adotou-se o **Modelo Híbrido com Triggers de Imutabilidade e Constraints Aritméticas no PostgreSQL**.

### Implementação Concreta no Banco de Dados
A migração inicial ([`src/infrastructure/persistence/mikro-orm/migrations/Migration20261017000001_InitialSchema.ts`](file:///Users/guilherme/testes/jungle_gaming_test/src/infrastructure/persistence/mikro-orm/migrations/Migration20261017000001_InitialSchema.ts)) instala a seguinte proteção:

```sql
-- Trigger Function que impede alteração e deleção no ledger
CREATE OR REPLACE FUNCTION trg_prevent_ledger_update_or_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'wallet_ledger_entries is append-only: updates and deletes are forbidden'
        USING ERRCODE = '55000'; -- Object not in prerequisite state
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wallet_ledger_entries_immutable
BEFORE UPDATE OR DELETE ON wallet_ledger_entries
FOR EACH ROW EXECUTE FUNCTION trg_prevent_ledger_update_or_delete();
```

Além da trigger, o banco valida matematicamente cada linha inserida via `CHECK constraint`:
```sql
ALTER TABLE wallet_ledger_entries ADD CONSTRAINT chk_ledger_entry_math CHECK (
    (direction = 'CREDIT' AND balance_after = balance_before + amount) OR
    (direction = 'DEBIT'  AND balance_after = balance_before - amount)
);
```

### Justificativa Técnica
- **Garantia de Não-Repúdio:** Mesmo que um atacante obtenha credenciais de banco ou haja um bug de código na aplicação tentando alterar um lançamento antigo, o PostgreSQL aborta a transação no nível do kernel relacional.
- **Paginação Estável por Cursor Monotônico:** A coluna `seq BIGSERIAL` provê um cursor sequencial absoluto para paginação estável do extrato contábil (`GET /wallets/:id/ledger`), imune a anomalias de paginação tradicional por `OFFSET/LIMIT`.

---

## ADR-005: Reconciliação Contábil em Tempo Real com Política de Não-Autocorreção

### Contexto
Sistemas financeiros distribuídos necessitam de mecanismos automatizados para verificar se o saldo materializado na carteira confere exatamente com a somatória histórica dos lançamentos do livro-razão. Caso haja qualquer discrepância, como o sistema deve reagir?

### Alternativas Avaliadas
1. **Auto-Correção Silenciosa ("Self-Healing"):** Caso `wallet.balance !== calculatedBalance`, a aplicação sobrescreve `wallet.balance = calculatedBalance` e registra um log informativo.
   - *Por que foi descartada?* Em sistemas financeiros, a auto-correção silenciosa é **antipattern crítico**. Se houve divergência, ela pode ser indício de race condition não detectada, fraude externa, manipulação manual no banco ou falha de hardware. Sobrescrever o saldo mascara a causa raiz e destrói evidências periciais de auditoria.
2. **Reconciliação Matemática com Auditoria e Alerta Estrito:**
   - O endpoint `POST /wallets/:id/reconciliation` executa uma consulta transacional de leitura (`REPEATABLE READ` ou com trava de leitura) comparando:
     $$\Delta = \text{wallet.balance} - \left( \sum \text{CREDIT} - \sum \text{DEBIT} \right)$$
   - Se $\Delta == 0.00$: retorna `consistent: true` e `difference: "0.00"`.
   - Se $\Delta \neq 0.00$: **não altera o banco**, emite log com nível `error`, incrementa a métrica de telemetria `reconciliation_mismatch_total` e retorna relatório detalhado de discrepância para ação do time de conformidade e auditoria.

### Decisão
Adotou-se a **Política de Tolerância Zero e Não-Autocorreção**.

### Justificativa Técnica
Garante conformidade com auditorias externas de órgãos reguladores de jogos de azar (MGA, UKGC, SPA/MF), preservando a fidelidade contábil e disparando alertas para as equipes de SRE e Compliance.

---

## ADR-006: Concorrência e Hot-Wallets: Lock Pessimista por Linha (`FOR UPDATE`)

### Contexto
Em cassinos online e plataformas de apostas esportivas, jogadores frequentemente realizam apostas repetidas em curtíssimos intervalos de tempo, utilizam recursos de *auto-bet*, ou recebem múltiplos prêmios e estornos simultâneos sobre a mesma carteira (*hot-wallet*). Sob 50 a 100 requisições simultâneas por segundo na mesma carteira, como garantir que o saldo nunca fique negativo e que nenhuma atualização seja perdida?

### Alternativas Avaliadas

#### 1. Lock Otimista (Controle por Coluna `version`)
- Cada leitura traz o registro com `version`. A atualização só é feita se `version = current_version`.
- *Comportamento sob alta concorrência:* Se 50 apostas simultâneas de R$ 2,00 competem por uma carteira com R$ 100,00, exatamente 1 transação tem sucesso e as outras 49 falham com `OptimisticLockException`.
- *Consequência:* Para que as 49 requisições não sejam descartadas com erro para o usuário final, a aplicação é obrigada a aplicar retentativas exponenciais (*retry loops*). Isso satura o pool de conexões com o banco, gera tempestades de retentativas (*retry storms*), eleva a latência p99 para a casa dos segundos e desperdiça massivamente ciclos de CPU.

#### 2. Lock Distribuído em Memória (Redis com Redlock)
- Antes de processar a aposta, o serviço adquire um lock distribuído no Redis para a chave `lock:wallet:{walletId}`.
- *Problemas Operacionais:*
  - Adiciona uma dependência síncrona crítica de rede externa na rota quente de processamento.
  - Perda de atomicidade: o lock no Redis é liberado fora do commit da transação do PostgreSQL. Se a rede oscilar entre a liberação do lock e o commit do banco, outra instância acessa o saldo desatualizado.
  - Risco de *split-brain* e complexidade de manutenção do algoritmo Redlock sob partições de rede.

#### 3. Lock Pessimista por Linha no Banco de Dados (`SELECT ... FOR UPDATE`)
- A transação SQL adquire a trava exclusiva diretamente na linha da carteira alvo:
  ```sql
  SELECT * FROM wallets WHERE id = :walletId FOR UPDATE;
  ```
- *Comportamento:*
  - **Granularidade Cirúrgica:** O lock afeta estritamente a linha daquela carteira específica. Carteiras de outros jogadores progridem com 100% de paralelismo sem qualquer interferência mútua.
  - **Fila Ordenada no Banco:** O motor MVCC do PostgreSQL enfileira as transações concorrentes na própria conexão do banco. Quando a transação 1 comita, a transação 2 obtém o lock imediatamente e lê o saldo atualizado pela transação 1.
  - **Cinto e Suspensório:** Como salvaguarda de defesa em profundidade, o `UPDATE` final ainda valida a versão (`WHERE id = :id AND version = :version`) e o schema SQL possui a constraint `CHECK (balance_amount >= 0)`.

### Decisão
Adotou-se o **Lock Pessimista por Linha (`SELECT ... FOR UPDATE`) com Salvaguardas de Defesa em Profundidade**.

### Comprovação Empírica (Resultados do Benchmark Fase 10)
Conforme documentado em [`docs/BENCHMARKS.md`](file:///Users/guilherme/testes/jungle_gaming_test/docs/BENCHMARKS.md), sob teste de estresse de saturação extrema de hot-wallet (1.500+ requisições simultâneas disputando uma carteira limítrofe de R$ 50,00):
- **Vazão sustentada:** 397 requisições por segundo em 1 única carteira.
- **Latência:** p50 de 39 ms e p99 de 155 ms.
- **Integridade:** Exatamente 50 transações debitaram R$ 1,00, as restantes foram rejeitadas com elegância (`422 INSUFFICIENT_FUNDS`), o saldo final terminou rigorosamente em R$ 0,00 e o teste de reconciliação contábil atestou zero divergências.

---

## ADR-007: Idempotência Persistente de Dois Níveis com Hashing Canônico e Dual-Compatibility

### Contexto
Em comunicações distribuídas de rede e sistemas de mensageria, quedas de conexão, timeouts de socket e retentativas automáticas de clientes são inevitáveis. Se um provedor de jogos envia uma aposta de R$ 50,00, o servidor processa o débito, mas a resposta HTTP sofre timeout antes de chegar ao provedor, o provedor reenviará a requisição. O sistema deve garantir que o jogador não seja debitado duas vezes.

### Alternativas Avaliadas
1. **Idempotência Apenas em Memória / Redis Cache:**
   - Armazena `idempotency_key -> response` no Redis com TTL de 24 horas.
   - *Problema:* O Redis é volátil. Se o nó do Redis reiniciar ou realizar despejo de memória (*eviction*), a chave é perdida e um replay subsequente debita a carteira novamente. Inaceitável para sistemas financeiros.
2. **Índice Único Apenas na Chave de Idempotência:**
   - Restringe `UNIQUE(idempotency_key)`.
   - *Problema:* Não protege contra o cenário onde o provedor reenvia a mesma aposta externa utilizando uma chave de idempotência diferente.

### Decisão
Implementou-se a **Idempotência Persistente de Dois Níveis no PostgreSQL** combinada com **JSON Canônico e Normalização Dual-Compatibility**:

1. **Nível 1 (Chave do Cliente):** Coluna `idempotency_key` com restrição `UNIQUE` na tabela `wager_transactions`.
2. **Nível 2 (Identificador de Negócio do Provedor):** Índice único composto `UNIQUE(provider_id, external_transaction_id)`.
3. **Cálculo de Hash Canônico (SHA-256):**
   - Para diferenciar com segurança matemática um **Replay Válido** de um **Conflito de Idempotência**, o sistema extrai o subconjunto de negócio do payload e gera um JSON Canônico (chaves ordenadas recursivamente em ordem alfabética).
   - O hash SHA-256 desse JSON normalizado é persistido em `payload_hash`.

```
[Chegada da Requisição com Idempotency-Key]
                   │
                   ▼
       Busca transação pela chave
                   ├── NÃO EXISTE ──► Cria transação nova e aplica regras contábeis
                   │
                   └── JÁ EXISTE
                         │
        Hash do payload atual confere com o salvo?
                         │
        ├── SIM ──► REPLAY VÁLIDO (HTTP 200 OK)
        │           Retorna snapshot original persistido (idempotentReplay: true)
        │           Sem alterar saldo e sem novo lançamento no ledger.
        │
        └── NÃO ──► CONFLITO DE IDEMPOTÊNCIA (HTTP 409 Conflict)
                    Rejeição imediata sem efeitos colaterais.
```

### Normalização Dual-Compatibility
Provedores de jogos e suítes de teste costumam enviar requisições monetárias em formatos distintos:
- Formato Jungle Gaming Oficial: `{ "money": { "amount": "10.00", "currency": "BRL" } }`
- Formato Plano Legado: `{ "amount": "10.00", "currency": "BRL" }`

Se o sistema fizesse o hash do JSON bruto recebido na borda, uma aposta enviada inicialmente no formato Jungle Gaming e reenviada no formato plano geraria hashes divergentes, disparando erroneamente um `409 Conflict` (falso conflito).  
A camada de DTOs ([`src/interfaces/http/dto/process-wager-transaction.dto.ts`](file:///Users/guilherme/testes/jungle_gaming_test/src/interfaces/http/dto/process-wager-transaction.dto.ts)) normaliza ambos os formatos para a mesma estrutura interna canônica antes do cálculo do hash SHA-256, garantindo que replays sintáticos cruzados sejam atendidos com sucesso como `200 OK` de replay idempotente.

---

## ADR-008: Mensageria Assíncrona via Transactional Outbox Pattern com Lease e `SKIP LOCKED`

### Contexto
Quando uma aposta é processada, eventos de domínio (`WalletBalanceChanged`, `WagerTransactionProcessed`) precisam ser transmitidos para sistemas downstream (data warehouse, anti-fraude, dashboards operacionais, auditoria).  
A abordagem ingênua consiste em commitar a alteração no banco de dados e, em seguida, invocar a API do broker (AWS SQS, Kafka ou RabbitMQ):

```typescript
// ANTIPATTERN: Problema do Dual-Write
await em.flush(); // Transação SQL commitada
await sqs.sendMessage(...); // SE A REDE CAIR AQUI: Evento perdido para sempre!
```

Caso a chamada de rede ao broker falhe após o commit no banco, o evento é perdido. Se invertida a ordem (publicar no broker antes do commit), caso o banco aborte por conflito de concorrência, o broker terá publicado um evento de uma aposta que nunca existiu ("evento fantasma").

### Alternativas Avaliadas
1. **Two-Phase Commit (2PC / XA Transactions):** Tenta coordenar commits distribuídos entre o PostgreSQL e o broker de mensagens. Descartado: adiciona enorme latência, fragilidade operacional e não é suportado pelo AWS SQS.
2. **Change Data Capture (CDC com Debezium/Kafka Connect):** Lê o Write-Ahead Log (WAL) do PostgreSQL e despacha eventos. Descartado: excesso de complexidade operacional para o escopo do serviço (exige manter cluster Kafka Connect, Zookeeper/KRaft e esquema de decodificação lógica no banco).
3. **Transactional Outbox Pattern com Lease e `FOR UPDATE SKIP LOCKED`:**
   - Na mesma transação SQL que altera a carteira e o ledger, o evento é persistido na tabela relacional `outbox_messages`.
   - Um worker em segundo plano ([`src/infrastructure/workers/outbox-publisher.worker.ts`](file:///Users/guilherme/testes/jungle_gaming_test/src/infrastructure/workers/outbox-publisher.worker.ts)) lê periodicamente os registros pendentes e despacha para a fila AWS SQS FIFO `wallet-events.fifo`.

### Decisão
Adotou-se o **Transactional Outbox Pattern com Reivindicação de Lease e `SKIP LOCKED`**.

### Mecanismo de Reivindicação e Tolerância a Crashes
Para viabilizar que múltiplos workers de instâncias distintas rodem em paralelo sem colisão nem bloqueio mútuo:

1. **Reivindicação Atômica por Lote (`claimBatch`):**
   ```sql
   SELECT * FROM outbox_messages
   WHERE published_at IS NULL AND next_attempt_at <= now()
   ORDER BY occurred_at
   FOR UPDATE SKIP LOCKED LIMIT 50;
   ```
2. **Lease Temporal:** O worker define `locked_until = now() + 30s` e commita a transação imediatamente, liberando o lock de linha do banco.
3. **Publicação no SQS FIFO:** O worker despacha os eventos para a fila FIFO informando `MessageDeduplicationId = event.id` e `MessageGroupId = event.aggregateId`.
4. **Resiliência a Morte Súbita (`SIGKILL`):** Se o nó sofrer crash após publicar no SQS mas antes de gravar `published_at = now()`, o lease de 30 segundos expira. Outro worker elegível reassume o lote e republica a mensagem; o broker SQS FIFO deduplica a mensagem pelo `eventId`, mantendo estritamente a semântica de entrega **At-Least-Once** sem duplicatas nos consumidores downstream.

---

## ADR-009: Consumo SQS FIFO com Inbox Pattern e Deduplicação Atômica

### Contexto
O processamento de apostas pode ocorrer de forma assíncrona recebendo comandos de transação a partir da fila AWS SQS FIFO `wager-transactions.fifo`. O processador precisa garantir que reentregas de mensagens pelo SQS (causadas por falhas de rede no ack, reinicializações ou expiração de visibilidade) nunca resultem em débitos repetidos.

### Alternativas Avaliadas
1. **Deduplicação Apenas pelo SQS FIFO:** Confiar exclusivamente na janela de deduplicação nativa do SQS FIFO. Descartado: a janela de deduplicação do SQS é de apenas 5 minutos. Reentregas ocorridas após 5 minutos seriam processadas como novas transações.
2. **Inbox Pattern Dedicado no Banco de Dados:**
   - Armazena envelopes de mensagens consumidas na tabela `inbox_messages` com chave primária composta `PRIMARY KEY (consumer_name, message_id)`.
   - Inserção atômica com `INSERT INTO inbox_messages ... ON CONFLICT DO NOTHING`.
   - Se o registro já existir e constar como processado, o consumidor efetua o `DeleteMessage` imediatamente na fila (ack) e aborta o processamento contábil.

### Decisão
Adotou-se o **Inbox Pattern no PostgreSQL com Separação de Mensagens Envenenadas (Poison Pills) via DLQ**.

### Tratamento de Falhas Transitórias vs. Definitivas (Poison Pills)
O worker SQS ([`src/interfaces/workers/wager-transactions-consumer.worker.ts`](file:///Users/guilherme/testes/jungle_gaming_test/src/interfaces/workers/wager-transactions-consumer.worker.ts)) categoriza erros rigorosamente:
- **Mensagem Malformada / JSON Quebrado (Poison Pill):** Encaminhada imediatamente para a Dead Letter Queue (`wager-transactions-dlq.fifo`) e deletada da fila principal, prevenindo o travamento (*head-of-line blocking*) da fila FIFO.
- **Rejeição por Regra de Negócio (ex: Saldo Insuficiente):** A rejeição é gravada na tabela de transações (`status: REJECTED`), o ledger permanece intacto e o consumidor faz ack normal (`DeleteMessage`) no SQS.
- **Falha Transitória de Infraestrutura (ex: Timeout do Banco):** A mensagem não recebe ack. O consumidor invoca `ChangeMessageVisibility` com backoff exponencial, permitindo que a mensagem seja reprocessada assim que a infraestrutura se restabelecer.

---

## ADR-010: Tolerância a Eventos Fora de Ordem (`PENDING_REFERENCE`) com Fast-Path e Backoff com Jitter

### Contexto
Em ambientes de apostas distribuídas com múltiplos provedores externos de jogos (ex: Evolution, Pragmatic Play) e redes concorrentes, transações dependentes podem trafegar por rotas de rede com latências assimétricas.  
É um cenário comum e documentado na especificação da Jungle Gaming a chegada de um prêmio (`WIN`), estorno (`REFUND`) ou cancelamento técnico (`ROLLBACK`) **antes** da aposta inicial (`BET`) ter sido registrada pelo motor.

### Alternativas Avaliadas
1. **Rejeitar Imediatamente com Erro 404/422 ("Transaction Not Found"):**
   - Obriga o provedor externo a implementar lógica de retentativa proprietária.
   - *Problema:* Muitos provedores externos desistem após 1 ou 2 tentativas e cancelam o prêmio do jogador, gerando prejuízos para o usuário e atritos de suporte.
2. **Bloquear a Thread HTTP em Polling Síncrono:**
   - O endpoint segura a requisição HTTP em um loop `while (!exists) sleep(100ms)`.
   - *Problema:* Esgota rapidamente os pools de workers HTTP, trava recursos de socket e estoura os timeouts de gateways (ex: Nginx 60s timeout).
3. **Máquina de Estados com Estado `PENDING_REFERENCE` (`HTTP 202 Accepted`):**
   - Se a transação referenciada não existir no momento da chegada, a transação dependente é gravada no banco com status `PENDING_REFERENCE` e o HTTP responde imediatamente `202 Accepted`.
   - A resolução ocorre por dois mecanismos complementares:
     - **Fast-Path Reativo:** Ao persistir uma `BET`, o use case verifica imediatamente se existem referências pendentes aguardando por ela (`claimDuePendingReferences`) e as processa no mesmo ciclo.
     - **Worker em Segundo Plano:** O `PendingReferenceResolverWorker` varre a cada 1 segundo transações pendentes que atingiram `next_attempt_at <= now()` utilizando `FOR UPDATE SKIP LOCKED`.

### Decisão
Adotou-se o **Padrão `PENDING_REFERENCE` com Fast-Path e Worker com Backoff Exponencial com Jitter**.

### Algoritmo de Backoff e Limites de Tolerância
Para evitar tempestades de consultas no banco (*thundering herd problem*), o cálculo de reagendamento utiliza:

$$\text{delay} = \min\left(1000\text{ms} \times 2^{\text{attempts}}, 60000\text{ms}\right) + \text{jitter}(0..1000\text{ms})$$

- **Limite de 10 Tentativas ou TTL de 15 Minutos:**  
  - *Por que 15 minutos?* Cobre com ampla folga janelas de instabilidade transitória de provedores de jogos ou reinicializações de nós.
  - *O que acontece ao expirar?* Transaciona em definitivo para o estado `REJECTED` com código de falha `REFERENCE_NOT_FOUND` e publica o evento correspondente na Outbox, encerrando o ciclo de vida da pendência de forma determinística.

---

## ADR-011: Topologia de Binário Único com Especialização de Papéis (`APP_ROLE`)

### Contexto
Um sistema distribuído maduro requer múltiplos componentes funcionais: Servidor de API HTTP, Consumidor de Filas SQS, Publicador de Outbox e Resolvedor de Pendências.  
Construir esses componentes como 4 projetos separados (múltiplos repositórios ou múltiplos binários) induz à duplicação de regras de domínio, complexidade na sincronização de schemas de banco de dados e sobrecarga de esteiras CI/CD.

### Alternativas Avaliadas
1. **Múltiplos Repositórios de Microsserviços:** Rejeitado devido ao overhead operacional desproporcional para compartilhar o modelo contábil puro e as entidades de persistência.
2. **Monolito Rígido (Executa tudo sempre em todas as instâncias):**
   - Toda instância sobe a API, consome da fila e roda os publishers.
   - *Problema:* Impede o dimensionamento independente. Sob um pico súbito de requisições HTTP, não é possível escalar apenas os nós web sem sobrecarregar o consumo de filas ou multiplicar conexões de polling no banco de dados.
3. **Monorepo com Binário Especializado por Variável de Ambiente (`APP_ROLE`):**
   - O mesmo container Docker e o mesmo código-fonte suportam diferentes papéis especializados definidos via `APP_ROLE`.

### Decisão
Adotou-se a **Arquitetura de Binário Único com Inicialização Condicional via `APP_ROLE`**:

```typescript
// src/main.ts
const appRole = process.env.APP_ROLE ?? 'all';

switch (appRole) {
  case 'api':
    // Inicializa apenas HTTP Controllers e documentação Swagger
    break;
  case 'consumer':
    // Inicializa apenas WagerTransactionsConsumerWorker
    break;
  case 'outbox':
    // Inicializa apenas OutboxPublisherWorker
    break;
  case 'resolver':
    // Inicializa apenas PendingReferenceResolverWorker
    break;
  case 'all':
  default:
    // Inicializa todos os módulos (ideal para dev local, CI e deploys consolidados)
    break;
}
```

### Justificativa Técnica
Permite deploy de containers especializados em produção (ex: 8 instâncias `APP_ROLE=api` atrás de um Load Balancer, 3 instâncias `APP_ROLE=consumer` para a fila SQS, 2 instâncias `APP_ROLE=outbox` e 2 instâncias `APP_ROLE=resolver`), viabilizando **escalonamento horizontal assimétrico** com zero duplicação de código.

---

## ADR-012: Observabilidade: OpenMetrics/Prometheus, Logs Pino e Contexto Assíncrono (`AsyncLocalStorage`)

### Contexto
Em sistemas financeiros que processam transações simultâneas distribuídas por requisições HTTP, filas de mensageria e workers em background, identificar em qual etapa uma aposta específica falhou é crítico. Passar objetos de logger e correlation IDs manualmente por dezenas de parâmetros de métodos contamina a assinatura de casos de uso e agrega acoplamento desnecessário.

### Alternativas Avaliadas
1. **Logs tradicionais não-estruturados (`console.log`):** Rejeitado. Incompatível com ingestão automatizada em Datadog, Grafana Loki, CloudWatch ou Splunk.
2. **Propagação Manual de Logger e Correlation ID:** Polui todos os métodos de domínio e aplicação com parâmetros como `(cmd, ctx, logger)`.
3. **Logs Estruturados JSON via Pino com Contexto Assíncrono Nativo (`AsyncLocalStorage`):**
   - Criação da classe singleton [`CorrelationContext`](file:///Users/guilherme/testes/jungle_gaming_test/src/infrastructure/observability/correlation-context.ts) baseada em `AsyncLocalStorage` do runtime.
   - O middleware HTTP e os consumidores de fila inicializam o contexto capturando o cabeçalho `X-Correlation-Id` (ou gerando um UUID v7 caso ausente).
   - O contexto armazena automaticamente `correlationId`, `instanceId`, `walletId`, `transactionId` e `providerId`.
   - O logger Pino injeta esses metadados automaticamente em todas as linhas de log emitidas no formato JSON para `stdout`.

### Decisão
Adotou-se **Pino com `AsyncLocalStorage` para Rastreabilidade Distribuída** e **`prom-client` para Exposição de Métricas no Padrão OpenMetrics/Prometheus** (`GET /metrics`).

### Métricas Padronizadas Expostas:
- `wager_transactions_total{status, kind}`: Total de transações contábeis por tipo e desfecho.
- `idempotent_replays_total{kind, source}`: Total de replays atendidos sem novo débito.
- `lock_conflicts_total{resource}`: Conflitos de lock pessimista mitigados na carteira.
- `outbox_lag_seconds`: Gauge da defasagem temporal do evento pendente mais antigo na Outbox.
- `processing_duration_seconds{operation, status}`: Histograma de latência das operações.
- `reconciliation_mismatch_total`: Contador de anomalias contábeis identificadas na reconciliação.

---

## ADR-013: Conformidade de Contrato & Compatibilidade Dupla (Dual-Compatibility)

### Contexto
A especificação do desafio técnico Jungle Gaming define padrões rigorosos de contratos HTTP e envelopes de mensagem SQS (Seções 9 e 10). Simultaneamente, suítes de testes automatizados e integrações legadas utilizavam rotas abreviadas e estruturas de campos planos.  
Quebrar contratos existentes para atender à nova especificação ou, inversamente, ignorar os contratos oficiais da Jungle Gaming resultaria em não-conformidade.

### Decisão
Implementou-se **Arquitetura de Compatibilidade Dupla Transparente (Dual-Compatibility)**:

1. **Roteamento Híbrido nos Controllers:**
   ```typescript
   // Suporta tanto a rota oficial do desafio quanto aliases diretos
   @Controller(['wagering/transactions', 'transactions'])
   export class WagerTransactionsController { ... }
   ```
2. **Consulta Canônica de Provedor:**
   - Rota Canônica Oficial: `GET /providers/:providerId/wagering/transactions/:externalTransactionId`
   - Alias Legado: `GET /transactions/external/:providerId/:externalId`
3. **Payloads Monetários Híbridos nos DTOs:**
   - Aceita o objeto canônico aninhado `{ "money": { "amount": "10.00", "currency": "BRL" } }`
   - Aceita também campos planos `{ "amount": "10.00", "currency": "BRL" }`
4. **Respostas Envelopadas Híbridas:**
   - Retorna simultaneamente as propriedades canônicas e seus equivalentes legados (ex: `transactionId` e `id`; `balance: { amount, currency }` e `resultBalance: "10.00"`).
5. **Envelope SQS Flexível:**
   - O consumidor SQS consome tanto o envelope oficial `{ "type": "WagerTransactionRequested", "data": { ... } }` quanto mensagens planas, inferindo automaticamente chaves de idempotência omitidas (`providerId:externalTransactionId`).

### Justificativa Técnica
Permite 100% de retrocompatibilidade com todas as suítes de testes anteriores, enquanto alcança 100% de conformidade com os requisitos estritos da Jungle Gaming.

---

## ADR-014: Isolamento de Carga: Separação OLTP vs. OLAP para Produção de Alta Escala

### Contexto
Para fins de avaliação local do desafio técnico e inspeção interativa em tempo real, o serviço expõe uma interface visual em `/dashboard` que consulta o histórico de operações diretamente no banco relacional (`GET /api/dashboard/operations`).  
Em ambientes de produção com dezenas de milhares de apostas por segundo, consultas analíticas concorrendo no mesmo banco de dados transacional comprometem a performance dos locks pessimistas (`SELECT ... FOR UPDATE`).

### Decisão
Definiu-se a **Estratégia de Desacoplamento Arquitetural OLTP vs. OLAP**:

1. **Ambiente Local / Demonstração:**
   - Consultas administrativas e dashboard utilizam limites rígidos (`LIMIT 25`) e cache no cliente, evitando sobrecarga no nó PostgreSQL local.
2. **Ambiente Produtivo de Alta Escala (Arquitetura Alvo):**
   - **Read Replicas Assíncronas:** Consultas operacionais de leitura são roteadas exclusivamente para réplicas de leitura do PostgreSQL, preservando 100% dos recursos do nó primário (escritor) para o processamento de apostas.
   - **CQRS com Ingestão Analítica (ClickHouse / OpenSearch):** Os eventos de domínio publicados pela Outbox (`wallet-events.fifo`) alimentam pipelines de ingestão para bancos de dados colunares (ClickHouse) ou de busca (OpenSearch). Telas de backoffice, relatórios regulatórios e dashboards analíticos consultam exclusivamente essas bases analíticas.
   - **Purga e Arquivamento do Outbox/Inbox:** As tabelas `outbox_messages` e `inbox_messages` operam como filas transitórias, contando com partições temporais ou rotinas de arquivamento (ex: expurgação de mensagens processadas há mais de 7 dias), evitando o inchaço de tabelas (*table bloat*) no PostgreSQL.

---

## ADR-015: Pirâmide de Testes Fail-Fast com Multi-Instância Real e Testes de Carga

### Contexto
Sistemas financeiros distribuídos frequentemente apresentam bugs que nunca se manifestam em testes unitários convencionais: *deadlocks* de banco de dados, condições de corrida entre threads independentes, *split-brain*, e anomalias de recuperação após reinicialização forçada de nós. Como garantir a confiabilidade integral do sistema antes de qualquer deploy?

### Decisão
Adotou-se uma **Estratégia de Validação Piramidal em Ordem Fail-Fast com Testes Multi-Instância de Processos Reais**:

```
                       /\
                      /  \
                     /    \    Fase 10: Testes de Carga & Estresse (autocannon, até 1.000 RPS)
                    /──────\
                   /        \   Fase 8: Testes Multi-Instância Reais (Bun.spawn, 3 nós, crashes)
                  /──────────\
                 /            \  Fase 4: Testes de Alta Concorrência (Hot-wallets, 100 threads)
                /──────────────\
               /                \ Fase 2, 6, 7: Testes de Integração (PostgreSQL + LocalStack reais)
              /──────────────────\
             /                    \ Fase 1, 3: Testes Unitários de Domínio & Use Cases (Puros)
            /──────────────────────\
           /  Lint Money + Typecheck \ Validação Estática Estrita (Zero float, tipos rigorosos)
          /──────────────────────────\
```

### Camadas da Pipeline de Validação:

1. **Lint Money (`bun run lint:money`):** Varredura estática de código que bloqueia qualquer menção a tipos flutuantes ou métodos inseguros antes mesmo da compilação.
2. **Typecheck Estrito (`bun run typecheck`):** Compilação TypeScript com `strict: true` e `noUncheckedIndexedAccess`.
3. **Testes Unitários (84 testes, ~600 ms):** Testam isoladamente as regras da `WageringPolicy`, transições de máquina de estado, lógica do `Money` e casos de uso com mocks de repositório.
4. **Testes de Integração (57 testes, ~6 s):** Executam contra instâncias reais de PostgreSQL 16 e LocalStack SQS FIFO, validando triggers SQL de imutabilidade, lock pessimista de banco, deduplicação no Inbox e expiração do Pending Reference Resolver.
5. **Testes de Concorrência Massiva (9 testes, 311 asserções, ~1.7 s):** Disparam cenários limítrofes (ex: 100 requisições simultâneas disputando uma hot-wallet de R$ 50, tempestades de 50x replays idênticos simultâneos e concorrência mista de BETs e WINs).
6. **Testes Multi-Instância Reais (7 testes, ~11 s):** Sobem 3 instâncias HTTP independentes em portas dinâmicas através de `Bun.spawn`, simulam mortes abruptas via `SIGKILL` no meio de transações e comprovam que a recuperação distribuída mantém o ledger 100% íntegro.
7. **Testes de Carga & Benchmark de Performance (`bun run test:load`):** Bateria de testes de carga via `autocannon` com medição percentilar detalhada (p50, p90, p99) e auditoria matemática pós-estresse.

---

## 📚 Documentos Técnicos Correlatos

Para aprofundamento em tópicos específicos, consulte os documentos dedicados do repositório:

- 🏛️ [**`ARCHITECTURE.md`**](file:///Users/guilherme/testes/jungle_gaming_test/ARCHITECTURE.md): Arquitetura hexagonal, máquina de estados e integração Keycloak/OIDC.
- 🗄️ [**`docs/DATABASE_SCHEMA.md`**](file:///Users/guilherme/testes/jungle_gaming_test/docs/DATABASE_SCHEMA.md): Diagrama ERD completo, catálogo de tabelas, índices e triggers PostgreSQL.
- 🧪 [**`docs/TESTING.md`**](file:///Users/guilherme/testes/jungle_gaming_test/docs/TESTING.md): Manual e tutorial detalhado de execução da pirâmide de testes.
- 📊 [**`docs/BENCHMARKS.md`**](file:///Users/guilherme/testes/jungle_gaming_test/docs/BENCHMARKS.md): Resultados empíricos de vazão (RPS), latência percentilar e resiliência sob carga.
- 📋 [**`CHANGELOG.md`**](file:///Users/guilherme/testes/jungle_gaming_test/CHANGELOG.md): Histórico completo de releases e evolução das fases do projeto.
