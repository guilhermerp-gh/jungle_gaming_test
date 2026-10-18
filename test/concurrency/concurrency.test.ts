/**
 * ============================================================================
 * 🧪 TESTES DE ALTA CONCORRÊNCIA E RESILIÊNCIA DE IDEMPOTÊNCIA (FASE 4)
 * ============================================================================
 * Arquivo: test/concurrency/concurrency.test.ts
 *
 * 🎯 RESPONSABILIDADE DESTE ARQUIVO:
 * Submeter o processador de apostas (Distributed Wagering Processor) a testes
 * extremos de paralelismo real, condições de corrida (race conditions), double
 * spending e tempestades de concorrência massiva contra o PostgreSQL real.
 *
 * 📋 O QUE ELE TESTA ESPECIFICAMENTE:
 * 1. Cenário 100/80/80 (Disputa de Saldo Concorrente Limítrofe):
 *    - Duas apostas simultâneas de R$ 80,00 disparadas exatamente no mesmo instante
 *      para uma carteira com saldo R$ 100,00.
 *    - Exatamente 1 transação é aceita (201 Created) e debitada.
 *    - Exatamente 1 transação é rejeitada (422 Unprocessable Entity - INSUFFICIENT_FUNDS).
 *    - O saldo final é rigorosamente R$ 20,00 e o ledger contém apenas 1 lançamento de débito.
 *    - A reconciliação contábil atesta integridade matemática absoluta (consistent: true).
 *
 * 2. Tempestade de Idempotência Massiva (50x e 100x Requisições com Mesma Chave):
 *    - Disparo simultâneo de 50 a 100 requisições HTTP em paralelo utilizando a MESMA
 *      Idempotency-Key e o mesmo corpo de aposta.
 *    - Exatamente 1 requisição efetua o processamento inicial (201 Created).
 *    - Todas as outras 49 ou 99 requisições recebem o replay idêntico salvo (200 OK
 *      com "idempotentReplay": true).
 *    - O saldo é debitado apenas UMA única vez, sem qualquer efeito colateral duplicado.
 *
 * 3. Hot Wallet / Esgotamento de Saldo Massivo (100 Apostas Simultâneas):
 *    - Uma carteira com saldo de R$ 50,00 recebe 100 apostas simultâneas de R$ 1,00 cada,
 *      todas com chaves de idempotência e identificadores externos únicos.
 *    - Exatamente 50 apostas são aprovadas (201 Created).
 *    - Exatamente 50 apostas são rejeitadas (422 INSUFFICIENT_FUNDS).
 *    - O saldo final é exatamente R$ 0,00 (NUNCA negativo, blindado pelo CHECK do banco).
 *    - O extrato do ledger possui exatamente 51 lançamentos (1 OPENING + 50 DEBITs).
 *    - Auditoria de reconciliação atesta conformidade contábil estrita.
 *
 * 4. Concorrência Mista (Apostas BET e Ganhos WIN Simultâneos):
 *    - 20 apostas de R$ 5,00 e 20 prêmios de R$ 2,50 disparados simultaneamente e de forma
 *      intercalada contra a mesma carteira.
 *    - Todos os 40 eventos concluem com sucesso (201 Created).
 *    - O saldo final converge com exatidão matemática (saldo inicial - débitos + créditos).
 *
 * 5. Paralelismo e Isolamento entre Carteiras Distintas:
 *    - 10 carteiras distintas recebendo 10 transações simultâneas cada (total 100 requisições).
 *    - Comprova que o lock pessimista é granular por linha (SELECT ... FOR UPDATE na carteira)
 *      e não introduz serialização na tabela inteira nem causa deadlocks.
 *
 * 6. Corrida com Mesma Chave de Idempotência e Payloads Divergentes:
 *    - Duas requisições simultâneas com a mesma Idempotency-Key mas dados diferentes.
 *    - Uma requisição é processada (201) e a concorrente divergente é rejeitada com 409
 *      IDEMPOTENCY_CONFLICT, sem corrupção de estado.
 *
 * 7. Corrida com Chaves Diferentes para o Mesmo (providerId, externalTransactionId):
 *    - Duas requisições simultâneas para o mesmo identificador externo do provedor.
 *    - Exatamente 1 é processada (201) e a concorrente recebe 409 IDEMPOTENCY_CONFLICT.
 *
 * 8. Concorrência e Idempotência de Depósitos Simultâneos:
 *    - 10 depósitos paralelos na mesma carteira convergem exatamente no saldo sem deadlocks.
 *    - Tempestade de replay com 20 requisições simultâneas com a mesma Idempotency-Key
 *      resulta em exatamente 1 crédito (201) e 19 replays (200 OK), sem dupla contagem.
 * ============================================================================
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { HttpModule } from "../../src/interfaces/http/http.module";
import { HttpExceptionFilter } from "../../src/interfaces/http/filters/http-exception.filter";
import { resetData, setupTestDb, type TestDb } from "../helpers/db";

// Helper para parse seguro de respostas JSON
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseJson(res: Response): Promise<any> {
  return res.json();
}

describe("Alta Concorrência & Resiliência de Idempotência (Fase 4)", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    // Configura pool amplo para suportar o pico de conexões concorrentes
    process.env.DB_POOL_MAX = "25";
    db = await setupTestDb();

    app = await NestFactory.create(
      HttpModule.register({ orm: db.orm, uow: db.uow }),
      { logger: false },
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.enableShutdownHooks();

    // Sobe em porta livre efêmera atribuída pelo SO
    await app.listen(0);
    const server = app.getHttpServer();
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (app) await app.close();
    if (db) await db.close();
  });

  beforeEach(async () => {
    await resetData(db);
  });

  // Helper para criar carteira via HTTP
  async function createWallet(balance = "100.00", currency = "BRL") {
    const playerId = randomUUID();
    const res = await fetch(`${baseUrl}/wallets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, currency, initialBalance: balance }),
    });
    expect(res.status).toBe(201);
    const body = await parseJson(res);
    return { walletId: body.id as string, playerId, currency };
  }

  // --------------------------------------------------------------------------
  // CENÁRIO 1: 100/80/80 (Disputa de Saldo Concorrente Limítrofe)
  // --------------------------------------------------------------------------
  describe("Cenário 100/80/80: Disputa de Saldo Concorrente", () => {
    it("permite apenas 1 débito de R$ 80,00 em saldo de R$ 100,00 e rejeita o segundo por saldo insuficiente", async () => {
      const { walletId, playerId, currency } = await createWallet("100.00");

      const betPayloadA = {
        providerId: "provider-evolution",
        externalTransactionId: `bet-80-a-${randomUUID()}`,
        playerId,
        walletId,
        roundId: "round-limite-1",
        gameId: "roulette",
        kind: "BET",
        amount: "80.00",
        currency,
      };

      const betPayloadB = {
        providerId: "provider-evolution",
        externalTransactionId: `bet-80-b-${randomUUID()}`,
        playerId,
        walletId,
        roundId: "round-limite-1",
        gameId: "roulette",
        kind: "BET",
        amount: "80.00",
        currency,
      };

      // Dispara rigorosamente no mesmo instante
      const [resA, resB] = await Promise.all([
        fetch(`${baseUrl}/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `key-80-a-${randomUUID()}`,
          },
          body: JSON.stringify(betPayloadA),
        }),
        fetch(`${baseUrl}/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `key-80-b-${randomUUID()}`,
          },
          body: JSON.stringify(betPayloadB),
        }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 422]);

      // Verifica corpo das respostas
      const bodyA = await parseJson(resA);
      const bodyB = await parseJson(resB);

      const successBody = resA.status === 201 ? bodyA : bodyB;
      const rejectedBody = resA.status === 422 ? bodyA : bodyB;

      expect(successBody.status).toBe("PROCESSED");
      expect(successBody.resultBalance).toBe("20.00");
      expect(rejectedBody.error.code).toBe("INSUFFICIENT_FUNDS");

      // Consulta saldo da carteira
      const walletRes = await fetch(`${baseUrl}/wallets/${walletId}`);
      const walletBody = await parseJson(walletRes);
      expect(walletBody.balance).toBe("20.00");
      expect(walletBody.version).toBe(3); // 1 open + 1 opening credit (saldo 100) + 1 bet aceito = 3

      // Extrato contábil no ledger: exatamente 1 OPENING e 1 DEBIT
      const ledgerRes = await fetch(`${baseUrl}/wallets/${walletId}/ledger`);
      const ledgerBody = await parseJson(ledgerRes);
      expect(ledgerBody.items.length).toBe(2);
      expect(ledgerBody.items[0].direction).toBe("CREDIT"); // OPENING 100.00
      expect(ledgerBody.items[1].direction).toBe("DEBIT");  // BET 80.00

      // Reconciliação contábil atesta consistência absoluta
      const reconRes = await fetch(`${baseUrl}/wallets/${walletId}/reconciliation`, { method: "POST" });
      const reconBody = await parseJson(reconRes);
      expect(reconBody.consistent).toBe(true);
      expect(reconBody.storedBalance).toBe("20.00");
      expect(reconBody.calculatedBalance).toBe("20.00");
      expect(reconBody.difference).toBe("0.00");
    });
  });

  // --------------------------------------------------------------------------
  // CENÁRIO 2: Tempestade de Idempotência Massiva (50x a 100x Mesma Chave)
  // --------------------------------------------------------------------------
  describe("Idempotência Massiva sob Tempestade de Requisições Paralelas", () => {
    it("50 requisições simultâneas com a MESMA Idempotency-Key geram 1 débito único (201) e 49 replays (200)", async () => {
      const { walletId, playerId, currency } = await createWallet("500.00");

      const sharedKey = `idemp-storm-${randomUUID()}`;
      const sharedExternalId = `tx-ext-${randomUUID()}`;
      const payload = {
        providerId: "pragmatic",
        externalTransactionId: sharedExternalId,
        playerId,
        walletId,
        roundId: "round-storm-1",
        gameId: "sweet-bonanza",
        kind: "BET",
        amount: "10.00",
        currency,
      };

      // Dispara 50 requisições concorrentes idênticas
      const count = 50;
      const promises = Array.from({ length: count }, () =>
        fetch(`${baseUrl}/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": sharedKey,
          },
          body: JSON.stringify(payload),
        }),
      );

      const responses = await Promise.all(promises);

      let createdCount = 0;
      let replayCount = 0;
      const txIds = new Set<string>();

      for (const res of responses) {
        if (res.status === 201) {
          createdCount++;
        } else if (res.status === 200) {
          replayCount++;
        }
        const data = await parseJson(res);
        if (data.id) txIds.add(data.id);
        if (res.status === 200) {
          expect(data.idempotentReplay).toBe(true);
        } else if (res.status === 201) {
          expect(data.idempotentReplay).toBe(false);
        }
      }

      // Exatamente 1 processamento real e 49 replays
      expect(createdCount).toBe(1);
      expect(replayCount).toBe(49);
      // Todas as 50 respostas apontam rigorosamente para o mesmo registro de transação
      expect(txIds.size).toBe(1);

      // Saldo da carteira deve ter sido debitado apenas UMA única vez: 500.00 - 10.00 = 490.00
      const walletRes = await fetch(`${baseUrl}/wallets/${walletId}`);
      const walletBody = await parseJson(walletRes);
      expect(walletBody.balance).toBe("490.00");
      expect(walletBody.version).toBe(3); // 2 inicial + 1 débito único aceito = 3

      // Reconciliação confirma integridade contábil
      const reconRes = await fetch(`${baseUrl}/wallets/${walletId}/reconciliation`, { method: "POST" });
      const reconBody = await parseJson(reconRes);
      expect(reconBody.consistent).toBe(true);
      expect(reconBody.storedBalance).toBe("490.00");
      expect(reconBody.difference).toBe("0.00");
    });
  });

  // --------------------------------------------------------------------------
  // CENÁRIO 3: Hot Wallet / Esgotamento Massivo (100 Apostas Concorrentes)
  // --------------------------------------------------------------------------
  describe("Hot Wallet: 100 Apostas Concorrentes com Esgotamento de Saldo", () => {
    it("aprova exatamente 50 apostas de R$ 1,00 em saldo R$ 50,00 e rejeita 50 com INSUFFICIENT_FUNDS", async () => {
      const { walletId, playerId, currency } = await createWallet("50.00");

      const totalRequests = 100;
      const promises = Array.from({ length: totalRequests }, (_, i) => {
        const betId = `hot-bet-${i}-${randomUUID()}`;
        return fetch(`${baseUrl}/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `key-${betId}`,
          },
          body: JSON.stringify({
            providerId: "provider-stress",
            externalTransactionId: betId,
            playerId,
            walletId,
            roundId: `round-${i}`,
            gameId: "hot-slots",
            kind: "BET",
            amount: "1.00",
            currency,
          }),
        });
      });

      const responses = await Promise.all(promises);

      let successCount = 0;
      let rejectedCount = 0;

      for (const res of responses) {
        if (res.status === 201) successCount++;
        else if (res.status === 422) rejectedCount++;
        else {
          const body = await parseJson(res);
          throw new Error(`Status inesperado: ${res.status} - ${JSON.stringify(body)}`);
        }
      }

      // 50 aprovadas e 50 rejeitadas
      expect(successCount).toBe(50);
      expect(rejectedCount).toBe(50);

      // Saldo final deve ser exatamente 0.00 (nunca negativo!)
      const walletRes = await fetch(`${baseUrl}/wallets/${walletId}`);
      const walletBody = await parseJson(walletRes);
      expect(walletBody.balance).toBe("0.00");
      expect(walletBody.version).toBe(52); // 2 inicial + 50 débitos bem-sucedidos = 52

      // Reconciliação comprova que 51 lançamentos batem exatamente com 0.00
      const reconRes = await fetch(`${baseUrl}/wallets/${walletId}/reconciliation`, { method: "POST" });
      const reconBody = await parseJson(reconRes);
      expect(reconBody.consistent).toBe(true);
      expect(reconBody.storedBalance).toBe("0.00");
      expect(reconBody.calculatedBalance).toBe("0.00");
      expect(reconBody.checkedEntries).toBe(51);
    });
  });

  // --------------------------------------------------------------------------
  // CENÁRIO 4: Concorrência Mista (Apostas BET e Prêmios WIN Simultâneos)
  // --------------------------------------------------------------------------
  describe("Concorrência Mista: BETs e WINs Simultâneos na Mesma Carteira", () => {
    it("20 BETs de R$ 5,00 e 20 WINs de R$ 2,50 intercalados convergem no saldo contábil exato de R$ 50,00", async () => {
      // Saldo inicial 100.00: 20 x 5.00 débitos (-100.00) + 20 x 2.50 créditos (+50.00) = Saldo final 50.00
      const { walletId, playerId, currency } = await createWallet("100.00");

      const reqs: Array<() => Promise<Response>> = [];

      // 20 requisições de BET (débito de 5.00)
      for (let i = 0; i < 20; i++) {
        const id = `bet-mixed-${i}-${randomUUID()}`;
        reqs.push(() =>
          fetch(`${baseUrl}/transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Idempotency-Key": `key-${id}` },
            body: JSON.stringify({
              providerId: "provider-mixed",
              externalTransactionId: id,
              playerId,
              walletId,
              roundId: `round-mixed-${i}`,
              gameId: "mixed-game",
              kind: "BET",
              amount: "5.00",
              currency,
            }),
          }),
        );
      }

      // 20 requisições de WIN (crédito de 2.50)
      for (let i = 0; i < 20; i++) {
        const id = `win-mixed-${i}-${randomUUID()}`;
        reqs.push(() =>
          fetch(`${baseUrl}/transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Idempotency-Key": `key-${id}` },
            body: JSON.stringify({
              providerId: "provider-mixed",
              externalTransactionId: id,
              playerId,
              walletId,
              roundId: `round-mixed-${i}`,
              gameId: "mixed-game",
              kind: "WIN",
              amount: "2.50",
              currency,
            }),
          }),
        );
      }

      // Embaralha as requisições para intercalar débitos e créditos
      reqs.sort(() => Math.random() - 0.5);

      // Dispara todas as 40 simultaneamente
      const responses = await Promise.all(reqs.map((fn) => fn()));

      for (const res of responses) {
        expect(res.status).toBe(201);
      }

      // Verifica saldo final esperado: 100.00 - 100.00 + 50.00 = 50.00
      const walletRes = await fetch(`${baseUrl}/wallets/${walletId}`);
      const walletBody = await parseJson(walletRes);
      expect(walletBody.balance).toBe("50.00");
      expect(walletBody.version).toBe(42); // 2 inicial + 40 transações = 42

      // Reconciliação contábil confirma integridade
      const reconRes = await fetch(`${baseUrl}/wallets/${walletId}/reconciliation`, { method: "POST" });
      const reconBody = await parseJson(reconRes);
      expect(reconBody.consistent).toBe(true);
      expect(reconBody.storedBalance).toBe("50.00");
      expect(reconBody.calculatedBalance).toBe("50.00");
      expect(reconBody.checkedEntries).toBe(41);
    });
  });

  // --------------------------------------------------------------------------
  // CENÁRIO 5: Concorrência em Múltiplas Carteiras Distintas
  // --------------------------------------------------------------------------
  describe("Escalabilidade Horizontal: Carteiras Distintas em Paralelo", () => {
    it("10 carteiras recebendo 10 transações simultâneas cada progridem sem deadlocks ou lock global", async () => {
      // Cria 10 carteiras com saldo R$ 50,00 cada
      const walletCount = 10;
      const wallets = await Promise.all(
        Array.from({ length: walletCount }, () => createWallet("50.00")),
      );

      // Para cada carteira, prepara 10 débitos de R$ 2,00 (total = 100 requisições simultâneas)
      const allRequests: Array<() => Promise<Response>> = [];
      for (const w of wallets) {
        for (let i = 0; i < 10; i++) {
          const extId = `multi-${w.walletId.slice(0, 8)}-${i}-${randomUUID()}`;
          allRequests.push(() =>
            fetch(`${baseUrl}/transactions`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Idempotency-Key": `key-${extId}` },
              body: JSON.stringify({
                providerId: "provider-multi",
                externalTransactionId: extId,
                playerId: w.playerId,
                walletId: w.walletId,
                roundId: `round-multi-${i}`,
                gameId: "multi-slots",
                kind: "BET",
                amount: "2.00",
                currency: w.currency,
              }),
            }),
          );
        }
      }

      // Embaralha e dispara todas as 100 requisições em paralelo
      allRequests.sort(() => Math.random() - 0.5);
      const responses = await Promise.all(allRequests.map((fn) => fn()));

      for (const res of responses) {
        expect(res.status).toBe(201);
      }

      // Valida cada carteira individualmente: saldo final deve ser 50.00 - (10 x 2.00) = 30.00
      for (const w of wallets) {
        const walletRes = await fetch(`${baseUrl}/wallets/${w.walletId}`);
        const walletBody = await parseJson(walletRes);
        expect(walletBody.balance).toBe("30.00");
        expect(walletBody.version).toBe(12); // 2 inicial + 10 débitos = 12

        const reconRes = await fetch(`${baseUrl}/wallets/${w.walletId}/reconciliation`, { method: "POST" });
        const reconBody = await parseJson(reconRes);
        expect(reconBody.consistent).toBe(true);
        expect(reconBody.storedBalance).toBe("30.00");
      }
    });
  });

  // --------------------------------------------------------------------------
  // CENÁRIO 6: Corrida com Mesma Chave de Idempotência e Payloads Divergentes
  // --------------------------------------------------------------------------
  describe("Conflito de Idempotência sob Condição de Corrida", () => {
    it("duas requisições simultâneas com a mesma Idempotency-Key mas payloads distintos resultam em 1 aceita (201) e 1 conflito (409)", async () => {
      const { walletId, playerId, currency } = await createWallet("100.00");

      const sharedKey = `conflict-race-key-${randomUUID()}`;

      // Payload 1: aposta de R$ 10,00 na roleta
      const payload1 = {
        providerId: "provider-conflict",
        externalTransactionId: `tx-1-${randomUUID()}`,
        playerId,
        walletId,
        roundId: "round-1",
        gameId: "roulette",
        kind: "BET",
        amount: "10.00",
        currency,
      };

      // Payload 2: aposta de R$ 25,00 no blackjack (mesma Idempotency-Key!)
      const payload2 = {
        providerId: "provider-conflict",
        externalTransactionId: `tx-2-${randomUUID()}`,
        playerId,
        walletId,
        roundId: "round-2",
        gameId: "blackjack",
        kind: "BET",
        amount: "25.00",
        currency,
      };

      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": sharedKey },
          body: JSON.stringify(payload1),
        }),
        fetch(`${baseUrl}/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": sharedKey },
          body: JSON.stringify(payload2),
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const conflictRes = res1.status === 409 ? res1 : res2;
      const conflictBody = await parseJson(conflictRes);
      expect(conflictBody.error.code).toBe("IDEMPOTENCY_CONFLICT");

      // Saldo da carteira reflete apenas a requisição aceita (ou 90.00 ou 75.00)
      const walletRes = await fetch(`${baseUrl}/wallets/${walletId}`);
      const walletBody = await parseJson(walletRes);
      expect(["90.00", "75.00"]).toContain(walletBody.balance);

      // Reconciliação consistente
      const reconRes = await fetch(`${baseUrl}/wallets/${walletId}/reconciliation`, { method: "POST" });
      const reconBody = await parseJson(reconRes);
      expect(reconBody.consistent).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // CENÁRIO 7: Corrida de Chaves Diferentes para o Mesmo (providerId, externalTransactionId)
  // --------------------------------------------------------------------------
  describe("Conflito de External Transaction Id sob Condição de Corrida", () => {
    it("duas requisições simultâneas com chaves diferentes para o mesmo externalId resultam em 1 aceita (201) e 1 conflito (409)", async () => {
      const { walletId, playerId, currency } = await createWallet("100.00");

      const sharedExternalId = `ext-dup-race-${randomUUID()}`;

      const payload = {
        providerId: "provider-unique-ext",
        externalTransactionId: sharedExternalId,
        playerId,
        walletId,
        roundId: "round-ext-1",
        gameId: "slots",
        kind: "BET",
        amount: "15.00",
        currency,
      };

      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": `key-alpha-${randomUUID()}` },
          body: JSON.stringify(payload),
        }),
        fetch(`${baseUrl}/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": `key-beta-${randomUUID()}` },
          body: JSON.stringify(payload),
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const conflictRes = res1.status === 409 ? res1 : res2;
      const conflictBody = await parseJson(conflictRes);
      expect(conflictBody.error.code).toBe("IDEMPOTENCY_CONFLICT");

      // Saldo debitado exatamente uma vez: 100.00 - 15.00 = 85.00
      const walletRes = await fetch(`${baseUrl}/wallets/${walletId}`);
      const walletBody = await parseJson(walletRes);
      expect(walletBody.balance).toBe("85.00");

      // Reconciliação consistente
      const reconRes = await fetch(`${baseUrl}/wallets/${walletId}/reconciliation`, { method: "POST" });
      const reconBody = await parseJson(reconRes);
      expect(reconBody.consistent).toBe(true);
      expect(reconBody.storedBalance).toBe("85.00");
    });
  });

  // --------------------------------------------------------------------------
  // CENÁRIO 8: Concorrência e Idempotência de Depósitos Simultâneos
  // --------------------------------------------------------------------------
  describe("Concorrência de Depósitos: Paralelismo e Tempestade de Replay", () => {
    it("10 depósitos simultâneos de R$ 10,00 na mesma carteira convergem exatamente no saldo (+ R$ 100,00)", async () => {
      const { walletId } = await createWallet("50.00");

      const deposits = Array.from({ length: 10 }, (_, i) =>
        fetch(`${baseUrl}/wallets/${walletId}/deposit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `dep-concurrent-${i}-${randomUUID()}`,
          },
          body: JSON.stringify({ amount: "10.00", providerId: "PIX" }),
        }),
      );

      const responses = await Promise.all(deposits);
      for (const res of responses) {
        expect(res.status).toBe(201);
      }

      // Saldo final deve ser exatamente 50.00 + 10 * 10.00 = 150.00
      const walletRes = await fetch(`${baseUrl}/wallets/${walletId}`);
      const walletBody = await parseJson(walletRes);
      expect(walletBody.balance).toBe("150.00");

      // Auditoria de Reconciliação Contábil
      const reconRes = await fetch(`${baseUrl}/wallets/${walletId}/reconciliation`, { method: "POST" });
      const reconBody = await parseJson(reconRes);
      expect(reconBody.consistent).toBe(true);
      expect(reconBody.storedBalance).toBe("150.00");
      expect(reconBody.difference).toBe("0.00");
    });

    it("tempestade de 20 requisições simultâneas com a MESMA Idempotency-Key resulta em 1 crédito (201) e 19 replays (200)", async () => {
      const { walletId } = await createWallet("50.00");
      const sharedKey = `dep-storm-${randomUUID()}`;

      const requests = Array.from({ length: 20 }, () =>
        fetch(`${baseUrl}/wallets/${walletId}/deposit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": sharedKey,
          },
          body: JSON.stringify({ amount: "30.00", providerId: "PIX" }),
        }),
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);
      const createdCount = statuses.filter((s) => s === 201).length;
      const replayCount = statuses.filter((s) => s === 200).length;

      expect(createdCount).toBe(1);
      expect(replayCount).toBe(19);

      // Saldo creditado exatamente uma vez: 50.00 + 30.00 = 80.00
      const walletRes = await fetch(`${baseUrl}/wallets/${walletId}`);
      const walletBody = await parseJson(walletRes);
      expect(walletBody.balance).toBe("80.00");

      const reconRes = await fetch(`${baseUrl}/wallets/${walletId}/reconciliation`, { method: "POST" });
      const reconBody = await parseJson(reconRes);
      expect(reconBody.consistent).toBe(true);
      expect(reconBody.storedBalance).toBe("80.00");
    });
  });
});
