# 📄 Fase 7 — Conformidade de Concorrência, Fast-Path e Observabilidade do Pending Reference Resolver

> Especificação de correção e endurecimento da implementação da Fase 7 do projeto **Distributed Wagering Processor**. Esta spec complementa `docs/executed/2026-10-17-phase-07-pending-reference-resolver.md` e corrige divergências identificadas na revisão de aderência.

---

## 📌 Metadados

| Campo | Valor |
|-------|-------|
| **Versão** | v1.0 |
| **Data** | 18/10/2026 |
| **Autor** | Guilherme |
| **Status** | Rascunho |
| **Prioridade** | Alta |
| **Tipo** | Correção |
| **Referência** | `docs/executed/2026-10-17-phase-07-pending-reference-resolver.md` |

---

## 📝 Resumo

Adequar o Pending Reference Resolver aos requisitos de concorrência distribuída, atomicidade do fast-path e observabilidade definidos na Fase 7. A seleção com `FOR UPDATE SKIP LOCKED` deve conservar a exclusividade do registro até sua decisão final, impedindo que dois workers tentem resolver a mesma pendência. O fast-path deve ser atômico para operações da mesma carteira e apenas priorizar pendências de outras carteiras. A entrega também deve incluir logs estruturados, métricas consistentes e testes de integração que comprovem os comportamentos sob PostgreSQL real.

---

## 📦 Escopo

### ✅ Incluído

- Tornar atômicos o claim e a resolução de cada `PENDING_REFERENCE` usando `FOR UPDATE SKIP LOCKED`.
- Proteger a transação pendente contra processamento concorrente e transições duplicadas.
- Ajustar o fast-path para resolver na mesma transação apenas pendências da mesma carteira e priorizar as demais.
- Emitir logs Pino estruturados e completar a instrumentação Prometheus do resolver e do fast-path.
- Corrigir e ampliar testes unitários e de integração para cobrir concorrência real, fast-path, backoff, logs e métricas.
- Executar a validação completa com PostgreSQL e dependências de integração disponíveis.

### ❌ Fora do Escopo

- Alterar regras contábeis, tipos de transação ou o modelo monetário `Money`.
- Criar migrations, tabelas, índices ou colunas novas sem necessidade técnica comprovada e autorização explícita.
- Implementar o orquestrador multi-processo da Fase 8.
- Alterar contratos HTTP públicos além do comportamento interno já definido para `202 PENDING_REFERENCE`.
- Refatorar módulos não relacionados ao resolver.

---

## 🔄 Fluxo Principal

### Comportamento Atual

1. O resolver busca candidatos vencidos com `claimDuePendingReferences()` dentro de uma transação curta.
2. Essa transação termina e libera os locks `SKIP LOCKED` antes de cada candidato ser resolvido em outra transação.
3. Outro worker pode selecionar a mesma pendência; a resolução passa a depender de conflitos posteriores em vez de uma reivindicação exclusiva.
4. Após processar uma referência, o fast-path executa fora da transação original e tenta resolver imediatamente pendências de qualquer carteira.
5. Erros do resolver são contabilizados, mas não possuem o log estruturado de auditoria exigido; testes de concorrência podem ser satisfeitos pelo fast-path antes de exercitarem os workers paralelos.

### Fluxo Proposto

1. Cada worker inicia uma transação SQL por pendência e seleciona uma candidata elegível com `FOR UPDATE SKIP LOCKED`.
2. Enquanto o lock da pendência estiver ativo, o worker bloqueia a carteira com `findByIdForUpdate`, busca a referência, reavalia `WageringPolicy` e aplica exatamente um desfecho: `APPLY`, `REJECT` ou reagendamento/timeout.
3. A atualização da transação, carteira, ledger e outbox ocorre na mesma transação do claim; o commit libera o registro apenas após sua decisão persistida.
4. Ao processar uma referência, o caso de uso encontra pendências dependentes ainda dentro de sua transação. Para a mesma carteira, resolve-as no mesmo contexto e lock. Para outra carteira, somente atualiza `next_attempt_at = now`, deixando a resolução financeira para o worker isolado.
5. Cada tentativa produz log estruturado de sucesso, rejeição, reagendamento ou erro; métricas registram o outcome, duração, erros e número atual de pendências, inclusive no fast-path.

### Fluxos Alternativos

- Se nenhum registro estiver disponível por estar bloqueado por outro worker, o ciclo conclui sem erro e aguarda o próximo polling.
- Se a carteira não existir, a pendência é rejeitada com `WALLET_NOT_FOUND`, sem ledger, e o evento de rejeição é inserido na outbox.
- Se a referência estiver ausente e o limite de tentativas ou TTL for atingido, a pendência é rejeitada com `REFERENCE_NOT_FOUND` na mesma transação do claim.
- Se o fast-path encontrar uma pendência de outra carteira, ele não bloqueia nem movimenta essa carteira; apenas a torna elegível imediatamente.

---

## 📐 Regras e Restrições

### Regras de Negócio

- Uma pendência só pode receber uma decisão terminal (`PROCESSED` ou `REJECTED`) e gerar, no máximo, um lançamento contábil.
- A carteira deve permanecer bloqueada pessimisticamente durante qualquer mutação de saldo, inclusive em resoluções assíncronas.
- `REFUND` e `ROLLBACK` seguem a regra de reversão única; a segunda reversão deve resultar em `ALREADY_REVERSED` sem efeito financeiro.
- Rejeições de negócio e timeout não criam ledger nem alteram saldo.
- A expiração ocorre quando a tentativa corrente atingir `RESOLVER_MAX_ATTEMPTS` ou a idade for maior ou igual a `RESOLVER_TTL_SECONDS`.
- O backoff deve ser inequívoco e testado: após contabilizar a tentativa, usar `min(1000 * 2^attempts, 60000) + jitter(0..1000ms)`; a semântica de `attempts` deve ser documentada no código e nos testes.

### Restrições Técnicas / Funcionais

- Usar PostgreSQL, `FOR UPDATE SKIP LOCKED` e o lock pessimista da carteira; não substituir por lock em memória, mutex local ou polling otimista.
- O claim não pode perder seu lock antes do desfecho ser persistido. Se for usado lease persistido como alternativa, ele deve ser atômico, ter expiração e cobertura de testes multi-instância.
- Para a mesma carteira, fast-path e processamento da referência devem compor uma única transação SQL; para carteiras diferentes, não realizar a resolução financeira no fast-path.
- Manter todos os valores financeiros em `Money`; é proibido usar `number` ou `float` para saldo, valor ou reconciliação.
- Usar a instância de `PendingReferenceMetrics` injetada; não criar métricas implícitas que deixem o fast-path fora do registro do módulo.
- Os logs devem usar o logger Pino/Nest configurado no projeto e conter `transactionId`, `providerId`, `referenceExternalTransactionId`, `walletId`, `attempts`, `outcome` e `durationMs` quando aplicável.
- Não executar migrations automaticamente. Os índices existentes `ix_pending_ref`, `ix_ref_lookup` e `ux_single_reversal` devem ser preservados.

---

## ✅ Critérios de Aceite

- [ ] Quando dois ou mais resolvers executarem simultaneamente, cada `PENDING_REFERENCE` elegível deverá ser reivindicada por no máximo um worker e não poderá gerar tentativas concorrentes de resolução.
- [ ] Quando uma pendência for processada por um worker, a seleção com `SKIP LOCKED`, a decisão, a alteração da carteira, o ledger e os eventos de outbox deverão ocorrer antes da liberação do lock da pendência.
- [ ] Quando um `WIN` ou `REFUND` pendente for resolvido, deverá existir exatamente um ledger associado à transação e o saldo deverá reconciliar com o ledger.
- [ ] Quando o fast-path encontrar pendência da mesma carteira, a referência e a pendência deverão ser confirmadas ou revertidas juntas na mesma transação SQL.
- [ ] Quando o fast-path encontrar pendência de outra carteira, ele deverá somente definir `next_attempt_at` como elegível imediatamente; a movimentação financeira deverá ocorrer no worker com lock da carteira alvo.
- [ ] Quando uma referência nunca chegar, a pendência deverá terminar em `REJECTED/REFERENCE_NOT_FOUND` após 10 tentativas ou 15 minutos, sem ledger nem alteração de saldo.
- [ ] Quando houver `REFUND` ou `ROLLBACK` já processado para a referência, a nova reversão deverá terminar em `REJECTED/ALREADY_REVERSED` sem lançamento adicional.
- [ ] Quando o resolver aplicar, rejeitar, expirar ou reagendar uma pendência, `pending_references_resolved_total{outcome}` deverá registrar o outcome correto; duração, erros e gauge de pendentes também deverão ser atualizados.
- [ ] Quando ocorrer resolução, rejeição, reagendamento ou erro, deverá existir log estruturado com todos os campos obrigatórios da spec.
- [ ] Quando `APP_ROLE` for `all` ou `resolver`, o worker deverá executar polling de 1 segundo; para outros papéis, deverá permanecer desativado e encerrar graciosamente em até 20 segundos.
- [ ] Quando a suíte for executada com PostgreSQL e serviços de integração disponíveis, `bun run test:all` deverá finalizar sem falhas.

---

## 🧩 Impacto Técnico

### Módulos / Camadas Impactadas

- Application: orquestração transacional do resolver e fast-path em `ProcessWagerTransactionUseCase`.
- Domain: sem alteração de regra de negócio prevista; apenas eventual clarificação da semântica de `attempts` em `WagerTransaction`.
- Infrastructure: repositório MikroORM, locks PostgreSQL e métricas Prometheus.
- Interfaces: worker do resolver, logs Pino e dashboard de métricas.
- Testes: unidade e integração com PostgreSQL real.

### Arquivos ou Áreas Prováveis

- `src/application/use-cases/resolve-pending-references.use-case.ts`
- `src/application/use-cases/process-wager-transaction.use-case.ts`
- `src/application/ports/repositories.port.ts`
- `src/domain/wagering/wager-transaction.ts`
- `src/infrastructure/persistence/repositories/mikro-orm-wager.repository.ts`
- `src/infrastructure/observability/pending-reference-metrics.ts`
- `src/interfaces/workers/pending-reference-resolver.worker.ts`
- `src/interfaces/workers/workers.module.ts`
- `src/interfaces/http/views/metrics-dashboard.view.ts`
- `test/unit/resolve-pending-references.use-case.test.ts`
- `test/unit/pending-reference-resolver.worker.test.ts`
- `test/integration/pending-reference-resolver.integration.test.ts`

### Dependências

- `@mikro-orm/core` / `@mikro-orm/postgresql`
- `prom-client`
- `nestjs-pino` / `pino`
- PostgreSQL para testes de integração
- LocalStack/SQS quando exigido pela suíte completa existente

---

## 🧭 Plano de Implementação

1. Definir a estratégia de claim atômico por pendência e adaptar porta/repositório para manter o lock até o desfecho persistido.
2. Reestruturar `ResolvePendingReferencesUseCase` para executar claim, lock da carteira, política, persistências e outbox na mesma transação por registro.
3. Ajustar o fast-path para receber o contexto transacional atual, resolver somente pendências da mesma carteira e priorizar as de outras carteiras.
4. Padronizar e injetar observabilidade: logs estruturados, métricas por outcome, duração, erros e gauge no worker e fast-path.
5. Formalizar a contagem de tentativas e cobrir o backoff exponencial com jitter e teto de 60 segundos em testes determinísticos.
6. Reescrever o cenário de integração concorrente para garantir que os resolvers, e não o fast-path, concorram sobre pendências elegíveis.
7. Executar checks, unidade, integração e suíte completa com infraestrutura disponível; corrigir somente falhas relacionadas a este escopo.

### Decisões Técnicas / Pontos em Aberto

- A solução preferencial é processar cada claim e sua resolução em uma única transação curta. Um lease persistido só poderá ser adotado se preservar as mesmas garantias e for justificado na implementação.
- A transação pendente deve ser selecionada com lock antes de ser lida/avaliada; confiar apenas no lock da carteira ou na trigger de estado terminal não atende ao requisito de claim exclusivo.
- O fast-path não deve criar uma nova instância de use case com métricas padrão; deve reutilizar dependências injetadas ou um serviço de resolução compartilhado.
- O painel deve apresentar pelo menos o gauge de pendências ativas e os outcomes de resolução; o endpoint `/metrics` permanece a fonte canônica dos quatro instrumentos Prometheus.

---

## 🧪 Testes Esperados

- [ ] Unitário: claim e resolução usam o mesmo contexto transacional; uma pendência já decidida não é aplicada novamente.
- [ ] Unitário: cada outcome atualiza a métrica correta; erros são contabilizados e logados com o contexto obrigatório.
- [ ] Unitário: backoff respeita tentativa contabilizada, jitter de 0 a 1000 ms e teto de 60 s.
- [ ] Unitário: fast-path resolve pendência da mesma carteira no contexto corrente e apenas prioriza pendência de outra carteira.
- [ ] Integração PostgreSQL: dois resolvers disputam as mesmas pendências elegíveis e cada uma é processada uma única vez, sem erros e sem ledger duplicado.
- [ ] Integração PostgreSQL: `WIN` antes de `BET` e `REFUND` antes de `BET` preservam saldo, ledger, referência e outbox corretos.
- [ ] Integração PostgreSQL: referência rejeitada produz `REFERENCE_NOT_PROCESSED`; timeout produz `REFERENCE_NOT_FOUND`; dupla reversão produz `ALREADY_REVERSED`.
- [ ] Integração PostgreSQL: reconciliação final de cada carteira permanece com diferença `0.00`.
- [ ] Integração: worker respeita `APP_ROLE`, intervalo de polling e shutdown gracioso.
- [ ] Qualidade: `bun run check` e `bun run test:all` passam com os serviços requeridos disponíveis.

---

## 🤖 Instruções para IA

### Objetivo Operacional

> Implemente somente os ajustes necessários para atingir aderência integral à Fase 7. Preserve as regras financeiras e contratos existentes. Em caso de dúvida sobre uma alteração de schema, migration ou contrato público, pergunte antes de assumir.

### O que a IA deve entregar

- Código implementado e funcional dentro deste escopo.
- Testes unitários e de integração que comprovem os critérios de concorrência, atomicidade, logs e métricas.
- Validação executada com a infraestrutura necessária, ou relatório explícito do serviço externo indisponível.
- Resumo claro das alterações efetuadas e das garantias concorrenciais obtidas.

### Observações específicas desta spec

> Não mascarar o teste de concorrência através do fast-path: o cenário deve provar que múltiplos workers disputam registros pendentes que ainda não foram resolvidos. Não considerar conflito de trigger, rollback incidental ou falha capturada como evidência de exclusividade correta; o requisito é evitar a tentativa concorrente desde o claim.

---

## 📁 Pós-execução da Spec

Quando esta spec for executada e todos os critérios de aceite estiverem validados, mover o arquivo para `docs/executed/`.
