# 📊 Relatório de Benchmarks de Performance & Resiliência sob Carga (Fase 10)

> Relatório oficial de testes de carga, medições de vazão (Throughput / RPS), latência percentilar (**p50, p90, p97.5, p99**) e integridade contábil do **Distributed Wagering Processor**, submetido a pressões extremas de concorrência massiva através do script automatizado `bun run test:load` via `autocannon`.

---

## 📌 Metadados da Rodada de Benchmark

| Parâmetro | Detalhe / Valor |
|-----------|-----------------|
| **Data da Execução** | 18/10/2026 |
| **Versão da Aplicação** | `0.10.0` |
| **Runtime** | Bun v1.4.3 (`x86_64-apple-darwin` / macOS Sonoma) |
| **Banco de Dados** | PostgreSQL 16.2 (Docker, container local em disco NVMe) |
| **Mensageria** | LocalStack SQS FIFO (`wager-transactions.fifo`, `wallet-events.fifo`) |
| **Ferramenta de Carga** | `autocannon` v8.0.0 (API programática em TypeScript) |
| **Total de Requisições da Rodada** | **14.430 requisições HTTP** |
| **Taxa Global de Erros de Sistema (5xx)** | **0,00% (Zero falhas 5xx)** |
| **Auditoria Contábil (Ledger vs Saldo)** | **100% Íntegro (Zero divergências contábeis)** |

---

## 🎯 Metodologia de Teste e Cenários

Os testes foram executados com a aplicação inicializada em modo completo (`APP_ROLE=all`) na porta padrão `3000`. Foram desenhados quatro cenários operacionais específicos para exercitar diferentes camadas do modelo contábil e de concorrência:

1. **Cenário A — Alta Dispersão (Baseline Throughput & Escala Horizontal):**
   - *Objetivo:* Medir a vazão máxima de processamento contábil puro quando não há contenção por linha no PostgreSQL.
   - *Configuração:* 30 carteiras distintas recebendo apostas simultâneas de R$ 1,00 (`kind: "BET"`) com chaves de idempotência únicas por conexão.
   - *Conexões Concorrentes:* 25 conexões simultâneas durante 5 segundos.

2. **Cenário B — Hot-Wallet Saturation (Concorrência Limítrofe & Lock Pessimista):**
   - *Objetivo:* Avaliar a fila de serialização do lock pessimista (`SELECT ... FOR UPDATE`), o tempo de espera dos workers e a integridade de saldo sob esgotamento de fundos.
   - *Configuração:* 1 única carteira inicializada com saldo de **R$ 50,00**, submetida a centenas de requisições concorrentes de R$ 1,00 até zerar o saldo.
   - *Validação de Negócio:* Exatamente 50 apostas devem ser aprovadas (`201 Created`), e todas as subsequentes rejeitadas com `422 Unprocessable Entity` (`INSUFFICIENT_FUNDS`), com saldo final terminando rigorosamente em R$ 0,00 (sem jamais negativar).

3. **Cenário C — Idempotency Replay Storm (Avalanche de Replays Idênticos):**
   - *Objetivo:* Medir a velocidade de atendimento do atalho de idempotência (leitura de snapshot salvo na tabela `wager_transactions` pelo índice único) sob avalanche de requisições idênticas.
   - *Configuração:* 1 aposta inicial gravada; em seguida, rajada de milhares de requisições simultâneas com a mesma `Idempotency-Key` e corpo idêntico.
   - *Validação de Negócio:* 100% dos replays devem responder `200 OK` com `"idempotentReplay": true`, sem duplicar débitos no saldo nem inserir registros no ledger.

4. **Cenário D — Carga Mista Dinâmica (Simulação Realista de Cassino):**
   - *Objetivo:* Simular o tráfego realista de uma plataforma de iGaming com mutações bidirecionais de saldo (créditos e débitos simultâneos) e referências de estorno.
   - *Distribuição:* 60% Apostas (`BET` R$ 2,00), 25% Vitórias (`WIN` R$ 5,00), 10% Depósitos (`DEPOSIT` R$ 10,00) e 5% Estornos (`REFUND` R$ 5,00).

---

## 📈 Resultados Consolidados de Desempenho

| Cenário de Teste | Requisições Totais | Throughput Médio (RPS) | Latência p50 | Latência p90 | Latência p97.5 | Latência p99 | Respostas 2xx / 201 | Respostas 4xx (Regras) | Falhas 5xx | Auditoria Contábil |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **A: Alta Dispersão (Baseline)** | 4.013 reqs | **803 RPS** | 27 ms | 36 ms | 56 ms | 81 ms | 4.013 | 0 | **0** | **✔ 100% Íntegro** |
| **B: Hot-Wallet Saturation** | 1.589 reqs | **397 RPS** | 39 ms | 85 ms | 137 ms | 155 ms | 50 | 1.539 | **0** | **✔ 100% Íntegro** |
| **C: Idempotency Replay Storm** | 4.996 reqs | **999 RPS** | 20 ms | 31 ms | 49 ms | 77 ms | 4.996 | 0 | **0** | **✔ 100% Íntegro** |
| **D: Carga Mista Dinâmica** | 3.832 reqs | **766 RPS** | 29 ms | 40 ms | 50 ms | 65 ms | 3.662 | 170 | **0** | **✔ 100% Íntegro** |

---

## 🔬 Análise Técnica dos Resultados

### 1. Throughput com Dispersão de Carteiras (803 RPS)
No Cenário A, onde cada requisição atuava sobre carteiras distintas, o processador alcançou **803 requisições por segundo**, com latência mediana (**p50**) de apenas **27 ms** e **p99** contido em **81 ms**.
- Cada uma dessas 4.013 requisições executou uma transação SQL completa com:
  1. `SELECT ... FOR UPDATE` na carteira específica.
  2. Validação da máquina de estados e idempotência.
  3. Débito no agregado `Wallet`.
  4. `INSERT` imutável em `wallet_ledger_entries`.
  5. `UPDATE wallets SET balance = ..., version = version + 1`.
  6. `INSERT` do evento de domínio em `outbox_messages`.
- O fato de p99 permanecer em 81 ms sob 25 conexões simultâneas demonstra que o lock pessimista granular por linha é extremamente rápido e não gera degradação na tabela como um todo.

### 2. Comportamento sob Hot-Wallet Saturation (397 RPS)
No Cenário B, centenas de requisições concorrentes disputaram a mesma linha da tabela `wallets`.
- A vazão reduziu para **397 RPS** devido à fila natural de serialização transacional do PostgreSQL (`SELECT ... FOR UPDATE`).
- A latência p99 subiu para **155 ms**, refletindo o tempo que as transações subsequentes aguardaram o commit das transações anteriores na mesma carteira.
- **Resultado Contábil Perfeito:** Exatamente **50 apostas** debitaram R$ 1,00 cada, e **1.539 requisições** foram rejeitadas com `422 Unprocessable Entity (INSUFFICIENT_FUNDS)`. O saldo final da carteira atingiu rigorosamente **R$ 0,00**, e a reconciliação matemática atestou zero divergências (`difference: "0.00"`).

### 3. Eficiência da Proteção de Idempotência (999 RPS)
No Cenário C, a rajada massiva de 4.996 requisições atingiu **999 RPS** (praticamente 1.000 requisições por segundo), com **p50 de 20 ms** e **p99 de 77 ms**.
- O atalho de leitura de snapshot persistido (`idempotentReplay: true`) evita o retrabalho de mutação do saldo e inserção no ledger, retornando a resposta original imediatamente e com latência mínima.
- O saldo da carteira permaneceu imutável em R$ 190,00, sem qualquer corrupção contábil.

### 4. Carga Mista Realista (766 RPS)
O Cenário D combinou apostas, prêmios, depósitos e estornos sobre 10 carteiras em paralelo.
- Alcançou **766 RPS** com distribuição de latência muito estável (**p50: 29 ms**, **p90: 40 ms**, **p99: 65 ms**).
- As 170 respostas `4xx` refletiram regras de negócio esperadas (ex.: estorno de aposta já revertida `ALREADY_REVERSED`).
- Todas as 10 carteiras foram auditadas ao fim do teste e 100% apresentaram conformidade perfeita (`consistent: true`).

---

## 📈 Telemetria Prometheus Coletada

Durante as rodadas de carga, o endpoint `/metrics` exportou os seguintes deltas de telemetria contábil e de concorrência:

```prometheus
# Métricas observadas durante os testes de carga
wager_transactions_total{status="PROCESSED"} 7826
wager_transactions_total{status="REJECTED"} 1731
idempotent_replays_total 5021
lock_conflicts_total 0
outbox_lag_seconds 56.60
reconciliation_mismatch_total 0
```

- **`lock_conflicts_total = 0`**: As transações enfileiraram no lock pessimista e concluíram dentro do timeout seguro, sem gerar deadlocks ou abortos de serialização não tratados.
- **`reconciliation_mismatch_total = 0`**: Nenhuma divergência entre saldo armazenado e histórico do ledger foi registrada em nenhuma carteira durante toda a execução.
- **`outbox_lag_seconds`**: Elevou-se temporariamente durante as rajadas e foi drenado progressivamente pelo worker `OutboxPublisherWorker`.

---

## 💡 Recomendações Arquiteturais para Produção

Com base nas evidências coletadas neste benchmark:

1. **Dimensionamento do Pool de Conexões do PostgreSQL:**
   - Para ambientes de produção com tráfego superior a 2.000 RPS, recomenda-se configurar o pool de conexões (`pool: { min: 20, max: 50 }`) e dimensionar o PostgreSQL com PgBouncer em modo transaction pooling.
2. **Escalabilidade Horizontal de Nós de API:**
   - Como o lock pessimista é escopado à linha da carteira no PostgreSQL, adicionar mais réplicas de API (`APP_ROLE=api`) escala o throughput linearmente para jogadores em carteiras distintas.
3. **Buffer de Replays de Idempotência em Memória (Opcional):**
   - Para provedores que realizam retentativas agressivas a cada poucos milissegundos, uma camada de cache L1 (Redis ou in-memory LRU com TTL de 60 segundos) para respostas de idempotência pode elevar o throughput de replays de 1.000 RPS para 10.000+ RPS sem tocar no banco de dados.

---

## 🏁 Conclusão

Os benchmarks da **Fase 10** comprovam empiricamente que a arquitetura do **Distributed Wagering Processor** suporta altas cargas concorrentes (**750 a 1.000 RPS por nó**), com latências medianas sub-30ms, sem deadlocks e — o mais importante — **com garantia matemática absoluta de integridade financeira e zero saldo negativo**.
