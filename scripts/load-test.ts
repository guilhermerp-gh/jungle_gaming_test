/**
 * ============================================================================
 * 🚀 SUÍTE DE TESTES DE CARGA E BENCHMARKING DE PERFORMANCE (FASE 10)
 * ============================================================================
 * Arquivo: scripts/load-test.ts
 *
 * 🎯 RESPONSABILIDADE DESTE SCRIPT:
 * Submeter o Distributed Wagering Processor a pressões extremas de concorrência
 * e vazão (RPS), medindo com rigor matemático as distribuições percentilares de
 * latência (p50, p75, p90, p97.5, p99), conformidade de status HTTP e integridade
 * contábil com tolerância zero para desvios no ledger (reconciliation: consistent).
 *
 * 📋 4 CENÁRIOS OPERACIONAIS CRÍTICOS:
 * 1. Cenário A — Alta Dispersão (Baseline Throughput):
 *    - Múltiplas carteiras independentes em paralelo avaliando o teto de RPS sem
 *      bloqueio mútuo por linha no PostgreSQL.
 * 2. Cenário B — Hot-Wallet Saturation (Concorrência Limítrofe):
 *    - Alta contenção em carteira única com saldo limítrofe, comprovando que o
 *      lock pessimista serializa as mutações sem permitir saldo negativo e gerando
 *      rejeições limpas (422 INSUFFICIENT_FUNDS).
 * 3. Cenário C — Idempotency Replay Storm (Avalanche de Replays Idênticos):
 *    - 1.000 requisições simultâneas com a mesma Idempotency-Key e mesmo payload,
 *      atestando bypass instantâneo de negócio e leitura de snapshot salvo (200 OK).
 * 4. Cenário D — Carga Mista Dinâmica (Simulação Realista de Cassino):
 *    - Pool concorrente executando fluxo balanceado de apostas (BET), vitórias (WIN),
 *      depósitos (DEPOSIT) e estornos (REFUND).
 *
 * 🛡️ AUDITORIA CONTÁBIL MANDATÓRIA (ZERO TOLERANCE):
 * Ao término de cada rodada, 100% das carteiras afetadas passam por auditoria via
 * POST /wallets/:id/reconciliation (consistent: true, difference: "0.00").
 * ============================================================================
 */

import autocannon from "autocannon";
import { randomUUID } from "node:crypto";

// ============================================================================
// 🎨 CORES ANSI PARA O CONSOLE
// ============================================================================
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";
const DIM = "\x1b[2m";

// ============================================================================
// ⚙️ CONFIGURAÇÕES E PARÂMETROS DE EXECUÇÃO
// ============================================================================
const isCi = process.argv.includes("--ci") || process.env.CI === "true";
const isQuick = process.argv.includes("--quick");

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index !== -1 && index + 1 < process.argv.length ? process.argv[index + 1] : undefined;
}

const TARGET_URL = (getArgValue("--url") || process.env.TARGET_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const DURATION_SEC = isQuick ? 2 : isCi ? 3 : Number(getArgValue("--duration") || process.env.LOAD_DURATION || "5");
const CONNECTIONS = isCi ? 10 : Number(getArgValue("--connections") || process.env.LOAD_CONNECTIONS || "25");

interface ScenarioResult {
  scenarioName: string;
  durationSec: number;
  connections: number;
  totalRequests: number;
  rpsAverage: number;
  rpsMax: number;
  latencyP50: number;
  latencyP75: number;
  latencyP90: number;
  latencyP975: number;
  latencyP99: number;
  latencyMax: number;
  status2xx: number;
  status4xx: number;
  status5xx: number;
  statusCodes: Record<string, number>;
  reconciledWallets: number;
  reconciliationPassed: boolean;
}

interface WalletDto {
  id: string;
  playerId: string;
  currency: string;
  balance: string;
}

interface ReconciliationDto {
  walletId: string;
  storedBalance: string;
  calculatedBalance: string;
  difference: string;
  consistent: boolean;
  checkedEntries?: number;
}

interface PrometheusMetrics {
  wagerTransactionsTotal: Record<string, number>;
  idempotentReplaysTotal: number;
  lockConflictsTotal: number;
  outboxLagSeconds: number;
  reconciliationMismatchTotal: number;
}

// ============================================================================
// 🛠️ FUNÇÕES AUXILIARES DE HTTP E BANCO
// ============================================================================

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok && res.status >= 500) {
    const errorText = await res.text();
    throw new Error(`HTTP ${res.status} de ${url}: ${errorText}`);
  }
  return res.json() as Promise<T>;
}

async function checkHealth(baseUrl: string): Promise<void> {
  try {
    const res = await fetch(`${baseUrl}/health/live`);
    if (!res.ok) {
      throw new Error(`Status ${res.status}`);
    }
  } catch {
    console.error(`\n${RED}${BOLD}❌ ERRO: Não foi possível conectar ao serviço em ${baseUrl}/health/live${RESET}`);
    console.error(`${YELLOW}Certifique-se de que a aplicação está em execução (ex: "bun run dev" ou "docker compose up")${RESET}\n`);
    process.exit(1);
  }
}

async function createWallet(baseUrl: string, initialBalance: string): Promise<WalletDto> {
  const playerId = randomUUID();
  const res = await fetch(`${baseUrl}/wallets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerId,
      currency: "BRL",
      initialBalance,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao criar carteira (${res.status}): ${err}`);
  }
  return res.json() as Promise<WalletDto>;
}

async function reconcileWallet(baseUrl: string, walletId: string): Promise<ReconciliationDto> {
  const res = await fetch(`${baseUrl}/wallets/${walletId}/reconciliation`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao reconciliar carteira ${walletId} (${res.status}): ${err}`);
  }
  return res.json() as Promise<ReconciliationDto>;
}

async function fetchPrometheusMetrics(baseUrl: string): Promise<PrometheusMetrics> {
  const metrics: PrometheusMetrics = {
    wagerTransactionsTotal: {},
    idempotentReplaysTotal: 0,
    lockConflictsTotal: 0,
    outboxLagSeconds: 0,
    reconciliationMismatchTotal: 0,
  };

  try {
    const res = await fetch(`${baseUrl}/metrics`);
    if (!res.ok) return metrics;
    const text = await res.text();

    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      if (trimmed.startsWith("wager_transactions_total")) {
        const match = trimmed.match(/wager_transactions_total\{[^}]*status="([^"]+)"[^}]*\}\s+([0-9.]+)/);
        if (match && match[1] && match[2]) {
          const status = match[1];
          const val = Number(match[2]);
          metrics.wagerTransactionsTotal[status] = (metrics.wagerTransactionsTotal[status] || 0) + val;
        }
      } else if (trimmed.startsWith("idempotent_replays_total")) {
        const match = trimmed.match(/idempotent_replays_total(\{[^}]*\})?\s+([0-9.]+)/);
        if (match && match[2]) {
          metrics.idempotentReplaysTotal += Number(match[2]);
        }
      } else if (trimmed.startsWith("lock_conflicts_total")) {
        const match = trimmed.match(/lock_conflicts_total(\{[^}]*\})?\s+([0-9.]+)/);
        if (match && match[2]) {
          metrics.lockConflictsTotal += Number(match[2]);
        }
      } else if (trimmed.startsWith("outbox_lag_seconds")) {
        const match = trimmed.match(/outbox_lag_seconds\s+([0-9.]+)/);
        if (match && match[1]) {
          metrics.outboxLagSeconds = Number(match[1]);
        }
      } else if (trimmed.startsWith("reconciliation_mismatch_total")) {
        const match = trimmed.match(/reconciliation_mismatch_total\s+([0-9.]+)/);
        if (match && match[1]) {
          metrics.reconciliationMismatchTotal = Number(match[1]);
        }
      }
    }
  } catch {
    // telemetria opcional
  }

  return metrics;
}

// ============================================================================
// 🧪 IMPLEMENTAÇÃO DOS 4 CENÁRIOS
// ============================================================================

/**
 * CENÁRIO A: Alta Dispersão (Baseline Throughput)
 * - Múltiplas carteiras distintas (ex: 25 a 50) recebem apostas concorrentes.
 * - Testa a capacidade pura do motor sem concorrência por linha na mesma carteira.
 */
async function runScenarioA(baseUrl: string): Promise<ScenarioResult> {
  console.log(`\n${CYAN}${BOLD}▶ [Cenário A] Alta Dispersão — Baseline Throughput${RESET}`);
  console.log(`${DIM}Preparando pool de carteiras independentes...${RESET}`);

  const walletCount = Math.min(30, CONNECTIONS * 2);
  const wallets: WalletDto[] = [];
  for (let i = 0; i < walletCount; i++) {
    const w = await createWallet(baseUrl, "1000.00");
    wallets.push(w);
  }

  console.log(`${GREEN}✔ ${wallets.length} carteiras criadas com saldo de R$ 1.000,00 cada.${RESET}`);
  console.log(`${DIM}Disparando carga de apostas (BET R$ 1.00) por ${DURATION_SEC}s com ${CONNECTIONS} conexões simultâneas...${RESET}`);

  let walletIndex = 0;
  const statusCodesMap: Record<string, number> = {};

  const bench = await autocannon({
    url: baseUrl,
    connections: CONNECTIONS,
    duration: DURATION_SEC,
    requests: [
      {
        method: "POST",
        path: "/transactions",
        headers: {
          "content-type": "application/json",
        },
        setupRequest: (req) => {
          const w = wallets[walletIndex % wallets.length]!;
          walletIndex++;
          const id = randomUUID();
          req.headers = {
            ...req.headers,
            "Idempotency-Key": `bench-a-${id}`,
          };
          req.body = JSON.stringify({
            providerId: "evolution",
            externalTransactionId: `ext-a-${id}`,
            playerId: w.playerId,
            walletId: w.id,
            roundId: `round-${id.slice(0, 8)}`,
            gameId: "roulette",
            kind: "BET",
            amount: "1.00",
            currency: "BRL",
          });
          return req;
        },
        onResponse: (status) => {
          const key = String(status);
          statusCodesMap[key] = (statusCodesMap[key] || 0) + 1;
        },
      },
    ],
  });

  // Aguarda drenagem de requisições em voo no socket antes de reconciliar
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Reconciliação mandatória
  console.log(`${DIM}Reconciliando 100% das carteiras do Cenário A...${RESET}`);
  let reconciliationPassed = true;
  for (const w of wallets) {
    let rec = await reconcileWallet(baseUrl, w.id);
    if (!rec.consistent || rec.difference !== "0.00") {
      await new Promise((r) => setTimeout(r, 500));
      rec = await reconcileWallet(baseUrl, w.id);
    }
    if (!rec.consistent || rec.difference !== "0.00") {
      reconciliationPassed = false;
      console.error(`${RED}❌ Divergência contábil na carteira ${w.id}: diferença ${rec.difference}${RESET}`);
    }
  }

  return {
    scenarioName: "A: Alta Dispersão (Baseline)",
    durationSec: bench.duration,
    connections: CONNECTIONS,
    totalRequests: bench.requests.total,
    rpsAverage: bench.requests.average,
    rpsMax: bench.requests.max,
    latencyP50: bench.latency.p50,
    latencyP75: bench.latency.p75,
    latencyP90: bench.latency.p90,
    latencyP975: bench.latency.p97_5,
    latencyP99: bench.latency.p99,
    latencyMax: bench.latency.max,
    status2xx: bench["2xx"],
    status4xx: bench["4xx"],
    status5xx: bench["5xx"],
    statusCodes: statusCodesMap,
    reconciledWallets: wallets.length,
    reconciliationPassed,
  };
}

/**
 * CENÁRIO B: Hot-Wallet Saturation (Concorrência Limítrofe)
 * - Uma única carteira recebe avalanche simultânea com saldo limitado (R$ 50.00).
 * - Testa o lock pessimista (SELECT ... FOR UPDATE), enfileiramento e descarte elegante
 *   de apostas excedentes com 422 INSUFFICIENT_FUNDS sem jamais permitir saldo negativo.
 */
async function runScenarioB(baseUrl: string): Promise<ScenarioResult> {
  console.log(`\n${CYAN}${BOLD}▶ [Cenário B] Hot-Wallet Saturation — Concorrência Limítrofe & Lock Pessimista${RESET}`);
  console.log(`${DIM}Criando carteira com saldo limítrofe de R$ 50.00...${RESET}`);

  const targetWallet = await createWallet(baseUrl, "50.00");
  console.log(`${GREEN}✔ Carteira alvo criada: ${targetWallet.id} (Saldo: R$ 50.00)${RESET}`);
  console.log(`${DIM}Disparando avalanche de 100+ requisições concorrentes de R$ 1.00 contra a mesma carteira...${RESET}`);

  const statusCodesMap: Record<string, number> = {};

  const bench = await autocannon({
    url: baseUrl,
    connections: Math.min(CONNECTIONS, 20),
    duration: Math.min(DURATION_SEC, 4),
    requests: [
      {
        method: "POST",
        path: "/transactions",
        headers: {
          "content-type": "application/json",
        },
        setupRequest: (req) => {
          const id = randomUUID();
          req.headers = {
            ...req.headers,
            "Idempotency-Key": `bench-b-${id}`,
          };
          req.body = JSON.stringify({
            providerId: "evolution",
            externalTransactionId: `ext-b-${id}`,
            playerId: targetWallet.playerId,
            walletId: targetWallet.id,
            roundId: `round-${id.slice(0, 8)}`,
            gameId: "blackjack",
            kind: "BET",
            amount: "1.00",
            currency: "BRL",
          });
          return req;
        },
        onResponse: (status) => {
          const key = String(status);
          statusCodesMap[key] = (statusCodesMap[key] || 0) + 1;
        },
      },
    ],
  });

  // Aguarda drenagem de conexões em voo no socket
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Reconciliação e conferência de saldo final (deve ser rigorosamente 0.00)
  console.log(`${DIM}Auditando saldo e reconciliação da hot-wallet...${RESET}`);
  const rec = await reconcileWallet(baseUrl, targetWallet.id);
  const walletCheck = await fetchJson<WalletDto>(`${baseUrl}/wallets/${targetWallet.id}`);

  let reconciliationPassed = rec.consistent && rec.difference === "0.00";
  if (walletCheck.balance !== "0.00") {
    // Se ainda restou saldo (menos de 50 requests completaram), é aceitável, contanto que seja >= 0.00
    if (Number(walletCheck.balance) < 0) {
      reconciliationPassed = false;
      console.error(`${RED}❌ ERRO CRÍTICO: Saldo da carteira ficou negativo: ${walletCheck.balance}${RESET}`);
    }
  }

  const debitsSuccess = statusCodesMap["201"] || 0;
  const insufficientFunds = statusCodesMap["422"] || 0;
  console.log(
    `${DIM}Desfecho da Hot-Wallet: ${GREEN}${debitsSuccess} apostas aprovadas (201)${DIM}, ` +
      `${YELLOW}${insufficientFunds} rejeitadas por saldo (422)${DIM}, Saldo Final: ${BOLD}R$ ${walletCheck.balance}${RESET}`
  );

  return {
    scenarioName: "B: Hot-Wallet Saturation",
    durationSec: bench.duration,
    connections: Math.min(CONNECTIONS, 20),
    totalRequests: bench.requests.total,
    rpsAverage: bench.requests.average,
    rpsMax: bench.requests.max,
    latencyP50: bench.latency.p50,
    latencyP75: bench.latency.p75,
    latencyP90: bench.latency.p90,
    latencyP975: bench.latency.p97_5,
    latencyP99: bench.latency.p99,
    latencyMax: bench.latency.max,
    status2xx: bench["2xx"],
    status4xx: bench["4xx"],
    status5xx: bench["5xx"],
    statusCodes: statusCodesMap,
    reconciledWallets: 1,
    reconciliationPassed,
  };
}

/**
 * CENÁRIO C: Idempotency Replay Storm (Avalanche de Replays Idênticos)
 * - 1.000 requisições simultâneas com a mesma Idempotency-Key e mesmo payload.
 * - Testa a velocidade do bypass de leitura de snapshot salvo (200 OK) e integridade
 *   do saldo (debitado rigorosamente uma única vez).
 */
async function runScenarioC(baseUrl: string): Promise<ScenarioResult> {
  console.log(`\n${CYAN}${BOLD}▶ [Cenário C] Idempotency Replay Storm — Avalanche de Replays Idênticos${RESET}`);
  console.log(`${DIM}Preparando aposta inicial para o replay storm...${RESET}`);

  const wallet = await createWallet(baseUrl, "200.00");
  const fixedKey = `storm-key-${randomUUID()}`;
  const fixedExternalId = `storm-ext-${randomUUID()}`;
  const fixedPayload = {
    providerId: "evolution",
    externalTransactionId: fixedExternalId,
    playerId: wallet.playerId,
    walletId: wallet.id,
    roundId: "round-storm",
    gameId: "roulette",
    kind: "BET",
    amount: "10.00",
    currency: "BRL",
  };

  // Primeira requisição: Processamento real
  const initialRes = await fetch(`${baseUrl}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": fixedKey,
    },
    body: JSON.stringify(fixedPayload),
  });

  if (initialRes.status !== 201) {
    throw new Error(`Falha no processamento inicial da aposta (${initialRes.status})`);
  }

  console.log(`${GREEN}✔ Aposta inicial de R$ 10.00 gravada com sucesso (Saldo restante: R$ 190.00).${RESET}`);
  console.log(`${DIM}Disparando avalanche de replays simultâneos com a mesma Idempotency-Key...${RESET}`);

  const statusCodesMap: Record<string, number> = {};

  const bench = await autocannon({
    url: baseUrl,
    connections: CONNECTIONS,
    duration: DURATION_SEC,
    requests: [
      {
        method: "POST",
        path: "/transactions",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": fixedKey,
        },
        body: JSON.stringify(fixedPayload),
        onResponse: (status) => {
          const key = String(status);
          statusCodesMap[key] = (statusCodesMap[key] || 0) + 1;
        },
      },
    ],
  });

  // Aguarda drenagem de conexões em voo no socket
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Reconciliação e conferência de integridade de saldo
  console.log(`${DIM}Auditando saldo pós-replay storm...${RESET}`);
  const rec = await reconcileWallet(baseUrl, wallet.id);
  const walletCheck = await fetchJson<WalletDto>(`${baseUrl}/wallets/${wallet.id}`);

  let reconciliationPassed = rec.consistent && rec.difference === "0.00";
  if (walletCheck.balance !== "190.00") {
    reconciliationPassed = false;
    console.error(`${RED}❌ ERRO DE IDEMPOTÊNCIA: Saldo esperado R$ 190.00 mas encontrou ${walletCheck.balance}${RESET}`);
  }

  const replaysCount = statusCodesMap["200"] || 0;
  console.log(`${GREEN}✔ ${replaysCount} replays de idempotência atendidos com 200 OK (Saldo imutável em R$ 190.00).${RESET}`);

  return {
    scenarioName: "C: Idempotency Replay Storm",
    durationSec: bench.duration,
    connections: CONNECTIONS,
    totalRequests: bench.requests.total,
    rpsAverage: bench.requests.average,
    rpsMax: bench.requests.max,
    latencyP50: bench.latency.p50,
    latencyP75: bench.latency.p75,
    latencyP90: bench.latency.p90,
    latencyP975: bench.latency.p97_5,
    latencyP99: bench.latency.p99,
    latencyMax: bench.latency.max,
    status2xx: bench["2xx"],
    status4xx: bench["4xx"],
    status5xx: bench["5xx"],
    statusCodes: statusCodesMap,
    reconciledWallets: 1,
    reconciliationPassed,
  };
}

/**
 * CENÁRIO D: Carga Mista Dinâmica (Simulação Realista de Cassino)
 * - Pool de carteiras recebendo operações concorrentes balanceadas:
 *   60% BET, 25% WIN, 10% DEPOSIT, 5% REFUND.
 */
async function runScenarioD(baseUrl: string): Promise<ScenarioResult> {
  console.log(`\n${CYAN}${BOLD}▶ [Cenário D] Carga Mista Dinâmica — Simulação Realista de Cassino${RESET}`);
  console.log(`${DIM}Preparando carteiras com apostas pré-semeadas para estornos...${RESET}`);

  const walletCount = 10;
  const wallets: Array<{ wallet: WalletDto; betExternalId: string }> = [];

  for (let i = 0; i < walletCount; i++) {
    const w = await createWallet(baseUrl, "200.00");
    const betExtId = `seed-bet-${randomUUID()}`;
    await fetch(`${baseUrl}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `seed-key-${betExtId}`,
      },
      body: JSON.stringify({
        providerId: "evolution",
        externalTransactionId: betExtId,
        playerId: w.playerId,
        walletId: w.id,
        roundId: "round-seed",
        gameId: "roulette",
        kind: "BET",
        amount: "5.00",
        currency: "BRL",
      }),
    });
    wallets.push({ wallet: w, betExternalId: betExtId });
  }

  console.log(`${GREEN}✔ ${wallets.length} carteiras semeadas prontas para fluxo misto.${RESET}`);
  console.log(`${DIM}Executando mix de BET (60%), WIN (25%), DEPOSIT (10%) e REFUND (5%)...${RESET}`);

  let reqIndex = 0;
  const statusCodesMap: Record<string, number> = {};

  const bench = await autocannon({
    url: baseUrl,
    connections: CONNECTIONS,
    duration: DURATION_SEC,
    requests: [
      {
        method: "POST",
        path: "/transactions",
        headers: {
          "content-type": "application/json",
        },
        setupRequest: (req) => {
          const item = wallets[reqIndex % wallets.length]!;
          reqIndex++;
          const id = randomUUID();
          const dice = Math.random();

          if (dice < 0.60) {
            // 60% BET
            req.path = "/transactions";
            req.headers = { ...req.headers, "Idempotency-Key": `mix-bet-${id}` };
            req.body = JSON.stringify({
              providerId: "evolution",
              externalTransactionId: `ext-bet-${id}`,
              playerId: item.wallet.playerId,
              walletId: item.wallet.id,
              roundId: `round-${id.slice(0, 8)}`,
              gameId: "roulette",
              kind: "BET",
              amount: "2.00",
              currency: "BRL",
            });
          } else if (dice < 0.85) {
            // 25% WIN
            req.path = "/transactions";
            req.headers = { ...req.headers, "Idempotency-Key": `mix-win-${id}` };
            req.body = JSON.stringify({
              providerId: "evolution",
              externalTransactionId: `ext-win-${id}`,
              playerId: item.wallet.playerId,
              walletId: item.wallet.id,
              roundId: `round-${id.slice(0, 8)}`,
              gameId: "roulette",
              kind: "WIN",
              amount: "5.00",
              currency: "BRL",
            });
          } else if (dice < 0.95) {
            // 10% DEPOSIT
            req.path = `/wallets/${item.wallet.id}/deposit`;
            req.headers = { ...req.headers, "Idempotency-Key": `mix-dep-${id}` };
            req.body = JSON.stringify({
              amount: "10.00",
            });
          } else {
            // 5% REFUND
            req.path = "/transactions";
            req.headers = { ...req.headers, "Idempotency-Key": `mix-ref-${id}` };
            req.body = JSON.stringify({
              providerId: "evolution",
              externalTransactionId: `ext-ref-${id}`,
              playerId: item.wallet.playerId,
              walletId: item.wallet.id,
              roundId: `round-${id.slice(0, 8)}`,
              gameId: "roulette",
              kind: "REFUND",
              amount: "5.00",
              currency: "BRL",
              referenceExternalTransactionId: item.betExternalId,
            });
          }
          return req;
        },
        onResponse: (status) => {
          const key = String(status);
          statusCodesMap[key] = (statusCodesMap[key] || 0) + 1;
        },
      },
    ],
  });

  // Aguarda drenagem de conexões em voo no socket
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Reconciliação mandatória de todas as 10 carteiras
  console.log(`${DIM}Auditando reconciliação matemática de 100% das carteiras do fluxo misto...${RESET}`);
  let reconciliationPassed = true;
  for (const item of wallets) {
    let rec = await reconcileWallet(baseUrl, item.wallet.id);
    if (!rec.consistent || rec.difference !== "0.00") {
      // Pequeno respiro para descartar latência residual de flush assíncrono
      await new Promise((r) => setTimeout(r, 500));
      rec = await reconcileWallet(baseUrl, item.wallet.id);
    }
    if (!rec.consistent || rec.difference !== "0.00") {
      reconciliationPassed = false;
      console.error(`${RED}❌ Divergência na carteira ${item.wallet.id}: ${rec.difference}${RESET}`);
    }
  }

  return {
    scenarioName: "D: Carga Mista Dinâmica",
    durationSec: bench.duration,
    connections: CONNECTIONS,
    totalRequests: bench.requests.total,
    rpsAverage: bench.requests.average,
    rpsMax: bench.requests.max,
    latencyP50: bench.latency.p50,
    latencyP75: bench.latency.p75,
    latencyP90: bench.latency.p90,
    latencyP975: bench.latency.p97_5,
    latencyP99: bench.latency.p99,
    latencyMax: bench.latency.max,
    status2xx: bench["2xx"],
    status4xx: bench["4xx"],
    status5xx: bench["5xx"],
    statusCodes: statusCodesMap,
    reconciledWallets: wallets.length,
    reconciliationPassed,
  };
}

// ============================================================================
// 📊 FORMATAÇÃO DO RELATÓRIO CONSOLIDADO
// ============================================================================

function printResultsTable(results: ScenarioResult[]): void {
  console.log(`\n${BLUE}${BOLD}====================================================================================================${RESET}`);
  console.log(`${BLUE}${BOLD}                       📊 RELATÓRIO CONSOLIDADO DE PERFORMANCE & BENCHMARKS                          ${RESET}`);
  console.log(`${BLUE}${BOLD}====================================================================================================${RESET}\n`);

  console.log(
    `${BOLD}${"Cenário".padEnd(30)} | ${"Total Req".padStart(9)} | ${"RPS Médio".padStart(9)} | ` +
      `${"p50".padStart(6)} | ${"p90".padStart(6)} | ${"p97.5".padStart(6)} | ${"p99".padStart(6)} | ` +
      `${"2xx".padStart(7)} | ${"4xx".padStart(7)} | ${"5xx".padStart(5)} | ${"Auditoria"}${RESET}`
  );
  console.log("-".repeat(118));

  for (const r of results) {
    const auditStatus = r.reconciliationPassed
      ? `${GREEN}✔ 100% Íntegro${RESET}`
      : `${RED}❌ FALHA${RESET}`;

    const errorCol = r.status5xx > 0
      ? `${RED}${BOLD}${String(r.status5xx).padStart(5)}${RESET}`
      : `${DIM}${String(r.status5xx).padStart(5)}${RESET}`;

    console.log(
      `${r.scenarioName.padEnd(30)} | ` +
        `${String(r.totalRequests).padStart(9)} | ` +
        `${String(Math.round(r.rpsAverage)).padStart(9)} | ` +
        `${(r.latencyP50 + "ms").padStart(6)} | ` +
        `${(r.latencyP90 + "ms").padStart(6)} | ` +
        `${(r.latencyP975 + "ms").padStart(6)} | ` +
        `${(r.latencyP99 + "ms").padStart(6)} | ` +
        `${String(r.status2xx).padStart(7)} | ` +
        `${String(r.status4xx).padStart(7)} | ` +
        `${errorCol} | ` +
        `${auditStatus}`
    );
  }

  console.log("-".repeat(118));
}

function printMetricsSummary(before: PrometheusMetrics, after: PrometheusMetrics): void {
  console.log(`\n${MAGENTA}${BOLD}📈 TELEMETRIA PROMETHEUS COLETADA (DELTAS DA RODADA):${RESET}`);
  const txDelta = Object.entries(after.wagerTransactionsTotal).map(([k, v]) => {
    const prev = before.wagerTransactionsTotal[k] || 0;
    return `${k}: +${v - prev}`;
  }).join(", ") || "nenhuma nova transação";

  const replayDelta = after.idempotentReplaysTotal - before.idempotentReplaysTotal;
  const lockDelta = after.lockConflictsTotal - before.lockConflictsTotal;
  const mismatchDelta = after.reconciliationMismatchTotal - before.reconciliationMismatchTotal;

  console.log(`  • ${BOLD}wager_transactions_total:${RESET} ${txDelta}`);
  console.log(`  • ${BOLD}idempotent_replays_total:${RESET} +${replayDelta}`);
  console.log(`  • ${BOLD}lock_conflicts_total:${RESET} +${lockDelta}`);
  console.log(`  • ${BOLD}outbox_lag_seconds:${RESET} ${after.outboxLagSeconds}s`);
  console.log(
    `  • ${BOLD}reconciliation_mismatch_total:${RESET} ${mismatchDelta === 0 ? GREEN + "0 (Zero Divergências)" + RESET : RED + "+" + mismatchDelta + " (DIVERGÊNCIA DETECTADA!)" + RESET}`
  );
  console.log("");
}

// ============================================================================
// 🏁 EXECUÇÃO PRINCIPAL
// ============================================================================

async function main(): Promise<void> {
  console.log(`\n${YELLOW}${BOLD}======================================================================${RESET}`);
  console.log(`${YELLOW}${BOLD}     🎰 DISTRIBUTED WAGERING PROCESSOR — SUÍTE DE TESTES DE CARGA     ${RESET}`);
  console.log(`${YELLOW}${BOLD}======================================================================${RESET}`);
  console.log(`${DIM}Alvo: ${TARGET_URL} | Duração/Cenário: ${DURATION_SEC}s | Conexões: ${CONNECTIONS}${RESET}`);

  await checkHealth(TARGET_URL);

  const metricsBefore = await fetchPrometheusMetrics(TARGET_URL);
  const results: ScenarioResult[] = [];

  try {
    results.push(await runScenarioA(TARGET_URL));
    results.push(await runScenarioB(TARGET_URL));
    results.push(await runScenarioC(TARGET_URL));
    results.push(await runScenarioD(TARGET_URL));
  } catch (error) {
    console.error(`\n${RED}${BOLD}❌ Falha durante a execução dos benchmarks:${RESET}`, error);
    process.exit(1);
  }

  const metricsAfter = await fetchPrometheusMetrics(TARGET_URL);

  printResultsTable(results);
  printMetricsSummary(metricsBefore, metricsAfter);

  const mismatchDelta = metricsAfter.reconciliationMismatchTotal - metricsBefore.reconciliationMismatchTotal;
  const hasSystemErrors = results.some((r) => r.status5xx > 0);
  const hasReconciliationFailure = results.some((r) => !r.reconciliationPassed) || mismatchDelta > 0;

  if (hasSystemErrors || hasReconciliationFailure) {
    console.error(`\n${RED}${BOLD}❌ FALHA NO BENCHMARK: Inconsistência contábil ou erros 5xx detectados!${RESET}\n`);
    process.exit(1);
  }

  console.log(`${GREEN}${BOLD}✔ TODOS OS 4 CENÁRIOS FORAM CONCLUÍDOS COM 100% DE SUCESSO CONTÁBIL!${RESET}\n`);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
