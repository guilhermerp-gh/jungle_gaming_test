# 📄 Fase 8 — Multi-instância e Recuperação Distribuída

> Especificação da Fase 8 do **Distributed Wagering Processor**. Esta fase comprova, com processos Bun independentes compartilhando PostgreSQL e LocalStack, que as garantias financeiras e de mensageria continuam válidas durante concorrência, encerramento e reinicialização de instâncias.

---

## 📌 Metadados

| Campo | Valor |
|-------|-------|
| **Versão** | v1.0 |
| **Data** | 18/10/2026 |
| **Autor** | Guilherme |
| **Status** | Concluído |
| **Prioridade** | Alta |
| **Tipo** | Feature / Testes de integração e resiliência |
| **Referência** | `docs/specs/2026-10-16-distributed-wagering-processor.md` |
| **Versão Alvo** | `0.8.0` |

---

## 📝 Resumo

Implementar um harness de integração que inicia três processos Bun independentes contra o mesmo PostgreSQL e LocalStack e valida o comportamento do serviço sob distribuição real. A fase deve demonstrar que locks por carteira, idempotência persistente, inbox, outbox e o resolver permanecem corretos quando nós concorrentes processam trabalho e quando um deles é terminado ou reiniciado. O resultado esperado é uma suíte repetível que encerra todos os filhos com segurança e comprova a consistência final do saldo e do ledger.

---

## 📦 Escopo

### ✅ Incluído

- Criar harness de testes multi-processo com `Bun.spawn` para subir três instâncias independentes da aplicação.
- Configurar portas, `APP_ROLE`, conexões e identificação de instância sem compartilhar estado em memória entre os processos filhos.
- Executar cenários concorrentes via HTTP e SQS contra PostgreSQL e LocalStack reais.
- Validar recuperação após `SIGTERM`/encerramento de um nó durante processamento, incluindo reinicialização de uma instância substituta.
- Comprovar recuperação de mensagens SQS não confirmadas, publicação pendente de outbox e resolução de referências pendentes após restart.
- Garantir limpeza determinística de processos, filas e dados de teste, sem afetar o banco de desenvolvimento.
- Adicionar scripts de teste e documentação operacional mínima para executar a suíte de Fase 8.

### ❌ Fora do Escopo

- Criar métricas globais, dashboard adicional, revisão completa de logs ou documentação arquitetural final da Fase 9.
- Teste de carga, benchmark de p50/p95/p99, k6 ou autocannon (Fase 10 opcional).
- Alterar regras financeiras, schema, migrations ou contratos HTTP/SQS já definidos nas fases anteriores.
- Implementar orquestração de produção (Kubernetes, autoscaling, service discovery ou load balancer).

---

## 🔄 Fluxo Principal

### Comportamento Atual

1. Os testes de concorrência exercitam múltiplas requisições contra uma instância Nest criada dentro do próprio processo de teste.
2. Workers e testes de integração já usam locks PostgreSQL, inbox/outbox e LocalStack, mas ainda não há um orquestrador que inicie três runtimes Bun isolados.
3. Falhas entre commit, ack de SQS e marcação da outbox são cobertas pontualmente, sem uma prova de recuperação por reinicialização de nós independentes.

### Fluxo Proposto

1. O harness prepara um banco de teste isolado e filas LocalStack exclusivas ou limpas para a execução.
2. Ele inicia três filhos via `Bun.spawn`, cada um com `DATABASE_URL`, URLs de fila, porta e `INSTANCE_ID` próprios; todos apontam para o mesmo PostgreSQL e LocalStack.
3. O harness aguarda `/health/ready` de cada instância antes de enviar carga HTTP ou mensagens SQS.
4. As operações são distribuídas entre as instâncias; o banco continua sendo a fonte de verdade para locks, idempotência, inbox, ledger e outbox.
5. Durante um cenário controlado, o harness encerra uma instância em um ponto seguro e inicia uma substituta com a mesma infraestrutura compartilhada.
6. As instâncias sobreviventes e a substituta concluem o trabalho recuperável; ao final, o harness consulta estado, ledger, inbox/outbox e filas.
7. A suíte confirma reconciliação de cada carteira, ausência de efeito financeiro duplicado e término limpo de todos os processos filhos.

### Fluxos Alternativos

- Se uma instância não ficar pronta dentro do timeout configurado, o harness deve capturar stdout/stderr, encerrar todos os filhos e falhar com diagnóstico objetivo.
- Se uma mensagem for redeliverada após a morte de seu consumidor, o novo processamento deve ser replay/inócuo pela inbox e/ou idempotência persistente.
- Se um evento for publicado antes da morte, mas a outbox não tiver recebido `published_at`, outra instância poderá republicá-lo após a expiração do lease; a entrega é at-least-once e consumidores devem deduplicar por `eventId`.
- Se a infraestrutura externa necessária não estiver disponível, os testes devem falhar ou ser explicitamente ignorados somente por uma pré-condição verificável, jamais substituídos por mocks.

---

## 📐 Regras e Restrições

### Regras de Negócio

- A carteira, o ledger e o resultado persistido da transação são a fonte de verdade; nenhum processo pode confiar em cache ou mutex local para correção.
- Uma transação com mesma chave de idempotência e mesmo payload produz somente um efeito financeiro, mesmo quando enviada a nós diferentes ou redeliverada após reinício.
- Toda carteira verificada ao fim do cenário deve satisfazer `wallet.balance == Σ(CREDIT) − Σ(DEBIT)`.
- Morte de processo não pode confirmar uma mensagem SQS antes do commit nem descartar uma outbox ainda não publicada.
- Mensagens e eventos podem ser entregues ao menos uma vez; duplicatas devem ser seguras por inbox, idempotência e `eventId`.

### Restrições Técnicas / Funcionais

- Usar processos reais com `Bun.spawn`; não simular multi-instância com múltiplos objetos de caso de uso no mesmo runtime.
- Usar PostgreSQL e LocalStack reais; não mockar repositórios, locks, SQS ou publisher nos cenários desta fase.
- Cada filho deve receber porta distinta e encerrar por `SIGTERM`, com escalonamento para encerramento forçado somente após timeout de limpeza.
- O setup deve usar exclusivamente o banco de teste protegido por `TEST_DB_NAME`/`TEST_DATABASE_URL`; nunca executar migrations ou limpeza contra o banco de desenvolvimento sem autorização explícita.
- Não usar `number`/`float` para valores financeiros nos fixtures, asserções de saldo ou reconciliação; valores monetários continuam como strings e `Money`.
- Não introduzir dependência de coordenador externo, lock distribuído em Redis ou mudança de schema para mascarar garantias que pertencem ao PostgreSQL.
- Os testes devem ser repetíveis, com timeouts explícitos, coleta de logs dos filhos e limpeza em `finally`/hooks de teardown.

---

## ✅ Critérios de Aceite

- [x] Quando o teste multi-instância iniciar, três processos Bun independentes devem atingir `/health/ready` e compartilhar o mesmo PostgreSQL e LocalStack.
- [x] Quando duas BETs de `80.00` forem enviadas por nós distintos para uma carteira com `100.00`, deve haver exatamente uma `PROCESSED`, uma `REJECTED/INSUFFICIENT_FUNDS`, saldo `20.00` e um único débito no ledger.
- [x] Quando a mesma transação for submetida em paralelo a três nós, deve existir somente uma transação e um único efeito financeiro; as demais respostas devem ser replays persistidos.
- [x] Quando carteiras distintas forem processadas simultaneamente por nós diferentes, não deve haver serialização global, deadlock não tratado ou mistura de estado entre carteiras.
- [x] Quando um consumidor for terminado após o commit e antes do ack, a mensagem redeliverada não deve duplicar inbox, transação, ledger nem saldo.
- [x] Quando um publisher for terminado após publicar e antes de registrar `published_at`, outro nó deve recuperar a outbox após o lease, e a eventual republicação deve preservar o contrato at-least-once com o mesmo `eventId`.
- [x] Quando um resolver for terminado enquanto há pendências elegíveis, outra instância ou a substituta deve concluir cada pendência no máximo uma vez, preservando a reconciliação da carteira.
- [x] Quando uma instância for reiniciada, os demais nós devem continuar processando trabalho e a instância substituta deve voltar a ficar pronta sem exigir reparo manual do banco ou das filas.
- [x] Ao final de cada cenário, todas as carteiras envolvidas devem passar por `assertLedgerConsistent`, não deve haver processo filho órfão e stdout/stderr deve estar disponível em caso de falha.
- [x] `bun run test:multi-instance` (ou script equivalente documentado) deve executar a suíte da fase com infraestrutura disponível.

---

## 🧩 Impacto Técnico

### Módulos / Camadas Impactadas

- Testes de integração/concorrência: harness de processos, cliente HTTP/SQS, fixtures e asserções de recuperação.
- Bootstrap/configuração: suporte mínimo a porta e identificação de instância por ambiente, se ainda não existir.
- Workers: validação integrada do consumidor SQS, publisher de outbox e resolver sob reinicialização, sem alterar suas regras de domínio.
- Documentação/scripts: comando dedicado e pré-requisitos de execução local.

### Arquivos ou Áreas Prováveis

- `test/multi-instance/` ou `test/concurrency/multi-instance-recovery.test.ts`
- `test/helpers/db.ts`
- Novos helpers de `Bun.spawn`, health check, coleta de logs e shutdown de filhos
- `src/infrastructure/config/config.ts`
- `src/main.ts`
- `src/interfaces/workers/*.worker.ts`
- `package.json`
- `docker-compose.yml`
- `README.md`

### Dependências

- Bun (`Bun.spawn`, `bun test`)
- PostgreSQL 16
- LocalStack SQS e `@aws-sdk/client-sqs`
- NestJS, MikroORM e a infraestrutura existente do projeto

---

## 🧭 Plano de Implementação

1. Definir o contrato do harness: variáveis por filho, portas livres, timeout de readiness, captura de logs e encerramento idempotente.
2. Criar helpers para iniciar três processos Bun, aguardar `/health/ready`, executar chamadas HTTP/SQS e encerrar/reiniciar uma instância de forma controlada.
3. Criar fixtures isoladas de PostgreSQL e LocalStack para a suíte, preservando a proteção contra uso de banco não destinado a testes.
4. Implementar o cenário multi-nó de hot wallet/idempotência e validar saldo, transações e ledger via API e banco.
5. Implementar cenários de crash/restart para consumidor, outbox publisher e pending reference resolver, usando barreiras/observabilidade existente para tornar o ponto de falha determinístico.
6. Adicionar o script de execução e documentar pré-requisitos, variáveis, timeout e diagnóstico de falhas.
7. Executar lint, typecheck e as suítes unitária, integração, concorrência e multi-instância com PostgreSQL/LocalStack disponíveis.

### Decisões Técnicas / Pontos em Aberto

- O harness deve preferir iniciar `bun src/main.ts` para validar o caminho de execução real; iniciar artefatos compilados só é aceitável se isso for o caminho de produção documentado.
- Cada cenário deve usar `APP_ROLE` mínimo necessário: `all` para prova end-to-end e papéis dedicados quando isso tornar o crash de consumer/outbox/resolver determinístico.
- A injeção de falha deve ser coordenada por sinal e por condição observável, não por `sleep` arbitrário. Caso seja necessário um hook exclusivamente de teste, ele deve ser isolado do runtime de produção e documentado.
- A publicação duplicada de outbox é comportamento esperado após crash entre publish e marcação; o teste deve verificar segurança de reentrega, não exigir exactly-once do SQS.

---

## 🧪 Testes Esperados

- [ ] Multi-processo: três processos reais chegam a ready, recebem tráfego e fazem shutdown sem órfãos.
- [ ] Concorrência distribuída: cenário `100.00 / 80.00 / 80.00` e tempestade de idempotência entre nós distintos.
- [ ] Isolamento: várias carteiras em paralelo são processadas por nós diferentes sem serialização global.
- [ ] Consumer: crash pós-commit/pré-ack gera redelivery segura por inbox/idempotência.
- [ ] Outbox: crash pós-publicação/pré-marcar gera republicação segura após lease e preserva o mesmo `eventId`.
- [ ] Resolver: restart durante pendências fora de ordem não cria ledger duplicado nem deixa pendência travada após o lease/novo polling.
- [ ] Recuperação: desligar e subir uma instância no meio de cada cenário mantém os outros nós operacionais e termina com reconciliação correta.
- [ ] Qualidade: `bun run lint`, `bun run typecheck`, `bun run test:integration`, `bun run test:concurrency` e a suíte multi-instância passam com serviços disponíveis.

---

## 🤖 Instruções para IA

### Objetivo Operacional

> Implemente somente o harness e os ajustes mínimos necessários para comprovar multi-instância e recuperação distribuída. Preserve os contratos, regras financeiras e garantias de banco já existentes. Em caso de necessidade de migration, alteração de schema ou nova dependência de infraestrutura, pare e peça confirmação antes de assumir.

### O que a IA deve entregar

- Harness multi-processo funcional, com três instâncias Bun reais e teardown confiável.
- Testes de concorrência e recuperação que provem os critérios de aceite contra PostgreSQL e LocalStack reais.
- Script documentado para rodar a fase e diagnóstico suficiente quando algum filho não iniciar ou falhar.
- Resumo das alterações, comandos executados e garantias verificadas.

### Observações específicas desta spec

> Não considerar múltiplas instâncias do Nest dentro do mesmo processo como evidência desta fase. Não mascarar crash/restart por mocks, por estado em memória ou por espera fixa: a prova deve usar processos independentes e estado persistente compartilhado. Não executar migrations fora do banco de teste sem autorização explícita.

---

## 📁 Pós-execução da Spec

Quando esta spec for executada e todos os critérios de aceite estiverem validados, mover o arquivo para `docs/executed/`.
