/**
 * ============================================================================
 * 🧪 TESTES DE INTEGRAÇÃO E2E: API HTTP & CASOS DE USO (FASE 3)
 * ============================================================================
 * Arquivo: test/integration/http-api.test.ts
 *
 * 🎯 RESPONSABILIDADE DESTE ARQUIVO:
 * Validar o comportamento de ponta a ponta (End-to-End) de toda a camada de
 * API REST em NestJS integrada com o banco de dados PostgreSQL real. Ele garante
 * que os Controllers, Pipes de validação Zod, Filtros de Exceção padronizados e
 * os Casos de Uso funcionem exatamente de acordo com a especificação do contrato HTTP.
 *
 * 📋 O QUE ELE TESTA ESPECIFICAMENTE:
 * 1. Gerenciamento de Carteiras (`POST /wallets` e `GET /wallets/:id`):
 *    - `201 Created`: Criação de carteira com saldo inicial e lançamento contábil `OPENING` atômico.
 *    - `409 Conflict`: Rejeição imediata de cadastro duplicado para mesmo jogador e moeda (`WALLET_ALREADY_EXISTS`).
 *    - `400 Bad Request`: Validação estrita via Zod (UUIDs inválidos, moedas incorretas, saldos negativos).
 *    - `200 OK`: Consulta de dados cadastrais e saldo atual por ID.
 *    - `404 Not Found`: Retorno padronizado para carteira inexistente (`WALLET_NOT_FOUND`).
 *
 * 2. Processamento de Transações de Apostas (`POST /transactions`):
 *    - `400 Bad Request`: Rejeição de requisições sem o cabeçalho obrigatório `Idempotency-Key`.
 *    - `400 Bad Request`: Bloqueio de envio externo de transações do tipo `OPENING`.
 *    - `201 Created`: Aposta `BET` processada com sucesso (debita saldo, salva no ledger e avança versão).
 *    - `422 Unprocessable Entity`: Bloqueio de aposta com saldo insuficiente (`INSUFFICIENT_FUNDS`).
 *    - `200 OK` (Idempotência / Replay): Reenvio da mesma requisição com a mesma `Idempotency-Key`
 *      devolve a resposta salva com `"idempotentReplay": true` sem debitar o jogador novamente.
 *    - `409 Conflict`: Reutilização da mesma chave com dados de aposta diferentes (`IDEMPOTENCY_CONFLICT`).
 *    - `202 Accepted`: Ganhos `WIN` ou estornos cuja aposta ainda não foi recebida (`PENDING_REFERENCE`).
 *    - `201 Created` / `422 Unprocessable Entity`: Estorno `REFUND` restaura saldo da aposta e uma
 *      segunda tentativa de reversão é bloqueada com `ALREADY_REVERSED`.
 *
 * 3. Consultas e Auditoria Contábil:
 *    - `GET /transactions/:id`: Consulta por ID interno e por `providerId + externalTransactionId`.
 *    - `GET /wallets/:id/ledger`: Extrato contábil com paginação sequencial por cursor opaco (`base64`).
 *    - `POST /wallets/:id/reconciliation`: Auditoria em tempo real confrontando o saldo gravado
 *      com o somatório de todos os créditos e débitos do livro-razão (`consistent: true`).
 *
 * 4. Padrão de Erro da API:
 *    - Garante que todos os erros respeitem o envelope `{ "error": { "code", "message", "retryable" } }`.
 * ============================================================================
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { HttpModule } from "../../src/interfaces/http/http.module";
import { HttpExceptionFilter } from "../../src/interfaces/http/filters/http-exception.filter";
import { resetData, setupTestDb, type TestDb } from "../helpers/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseJson(res: Response): Promise<any> {
  return res.json();
}

describe("HTTP API & Controllers (Fase 3 Integration)", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    db = await setupTestDb();

    app = await NestFactory.create(
      HttpModule.register({ orm: db.orm, uow: db.uow }),
      { logger: false },
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.enableShutdownHooks();

    // Inicia na porta 0 (porta livre efêmera atribuída pelo SO)
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

  describe("POST /wallets", () => {
    it("cria carteira com saldo inicial e lança OPENING no ledger", async () => {
      const playerId = randomUUID();
      const res = await fetch(`${baseUrl}/wallets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          currency: "BRL",
          initialBalance: "150.00",
        }),
      });

      expect(res.status).toBe(201);
      const data = await parseJson(res);
      expect(data.playerId).toBe(playerId);
      expect(data.currency).toBe("BRL");
      expect(data.balance).toBe("150.00");
      expect(data.version).toBe(2); // open (v1) + credit (v2)

      // Verifica extrato ledger criado
      const ledgerRes = await fetch(`${baseUrl}/wallets/${data.id}/ledger`);
      expect(ledgerRes.status).toBe(200);
      const ledger = await parseJson(ledgerRes);
      expect(ledger.items.length).toBe(1);
      expect(ledger.items[0].direction).toBe("CREDIT");
      expect(ledger.items[0].amount).toBe("150.00");
    });

    it("rejeita carteira duplicada para o mesmo jogador e moeda com 409 WALLET_ALREADY_EXISTS", async () => {
      const playerId = randomUUID();
      const body = JSON.stringify({ playerId, currency: "BRL", initialBalance: "10.00" });

      const first = await fetch(`${baseUrl}/wallets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      expect(first.status).toBe(201);

      const duplicate = await fetch(`${baseUrl}/wallets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      expect(duplicate.status).toBe(409);
      const err = await parseJson(duplicate);
      expect(err.error.code).toBe("WALLET_ALREADY_EXISTS");
      expect(err.error.retryable).toBe(false);
    });

    it("rejeita payload com dados inválidos retornando 400 INVALID_PAYLOAD", async () => {
      const res = await fetch(`${baseUrl}/wallets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: "not-a-uuid",
          currency: "BR", // menos de 3 chars
          initialBalance: "-50.00", // negativo
        }),
      });

      expect(res.status).toBe(400);
      const err = await parseJson(res);
      expect(err.error.code).toBe("INVALID_PAYLOAD");
    });
  });

  describe("GET /wallets/:id", () => {
    it("retorna dados da carteira existente", async () => {
      const playerId = randomUUID();
      const created = await parseJson(
        await fetch(`${baseUrl}/wallets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, currency: "BRL", initialBalance: "80.00" }),
        }),
      );

      const res = await fetch(`${baseUrl}/wallets/${created.id}`);
      expect(res.status).toBe(200);
      const data = await parseJson(res);
      expect(data.id).toBe(created.id);
      expect(data.balance).toBe("80.00");
    });

    it("retorna 404 WALLET_NOT_FOUND para id inexistente", async () => {
      const res = await fetch(`${baseUrl}/wallets/${randomUUID()}`);
      expect(res.status).toBe(404);
      const err = await parseJson(res);
      expect(err.error.code).toBe("WALLET_NOT_FOUND");
    });
  });

  describe("POST /transactions", () => {
    it("rejeita requisição sem header Idempotency-Key com 400 INVALID_PAYLOAD", async () => {
      const res = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const err = await parseJson(res);
      expect(err.error.code).toBe("INVALID_PAYLOAD");
    });

    it("rejeita kind = OPENING enviado externamente com 400 INVALID_PAYLOAD", async () => {
      const res = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "key-opening",
        },
        body: JSON.stringify({
          providerId: "p1",
          externalTransactionId: "ext-1",
          playerId: randomUUID(),
          walletId: randomUUID(),
          roundId: "r1",
          gameId: "g1",
          kind: "OPENING",
          amount: "10.00",
          currency: "BRL",
        }),
      });
      expect(res.status).toBe(400);
      const err = await parseJson(res);
      expect(err.error.code).toBe("INVALID_PAYLOAD");
    });

    it("processa BET com sucesso: debita saldo e retorna 201 Created", async () => {
      const playerId = randomUUID();
      const wallet = await parseJson(
        await fetch(`${baseUrl}/wallets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, currency: "BRL", initialBalance: "100.00" }),
        }),
      );

      const res = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "bet-key-1",
        },
        body: JSON.stringify({
          providerId: "provider-evolution",
          externalTransactionId: "ext-bet-001",
          playerId,
          walletId: wallet.id,
          roundId: "round-101",
          gameId: "roulette",
          kind: "BET",
          amount: "35.00",
          currency: "BRL",
        }),
      });

      expect(res.status).toBe(201);
      const data = await parseJson(res);
      expect(data.status).toBe("PROCESSED");
      expect(data.resultBalance).toBe("65.00");
      expect(data.idempotentReplay).toBe(false);

      // Confere saldo na carteira
      const checkWallet = await parseJson(await fetch(`${baseUrl}/wallets/${wallet.id}`));
      expect(checkWallet.balance).toBe("65.00");
      expect(checkWallet.version).toBe(3); // 1: open, 2: opening credit, 3: bet debit
    });

    it("rejeita BET com saldo insuficiente com 422 INSUFFICIENT_FUNDS", async () => {
      const playerId = randomUUID();
      const wallet = await parseJson(
        await fetch(`${baseUrl}/wallets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, currency: "BRL", initialBalance: "20.00" }),
        }),
      );

      const res = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "bet-insufficient-key",
        },
        body: JSON.stringify({
          providerId: "provider-evolution",
          externalTransactionId: "ext-bet-002",
          playerId,
          walletId: wallet.id,
          roundId: "round-101",
          gameId: "roulette",
          kind: "BET",
          amount: "50.00", // Saldo é 20.00
          currency: "BRL",
        }),
      });

      expect(res.status).toBe(422);
      const err = await parseJson(res);
      expect(err.error.code).toBe("INSUFFICIENT_FUNDS");
      expect(err.error.retryable).toBe(false);

      // Saldo permaneceu intacto
      const checkWallet = await parseJson(await fetch(`${baseUrl}/wallets/${wallet.id}`));
      expect(checkWallet.balance).toBe("20.00");
    });

    it("replay idêntico com mesma Idempotency-Key retorna 200 OK com snapshot", async () => {
      const playerId = randomUUID();
      const wallet = await parseJson(
        await fetch(`${baseUrl}/wallets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, currency: "BRL", initialBalance: "100.00" }),
        }),
      );

      const payload = {
        providerId: "provider-evolution",
        externalTransactionId: "ext-bet-replay",
        playerId,
        walletId: wallet.id,
        roundId: "round-replay",
        gameId: "roulette",
        kind: "BET",
        amount: "25.00",
        currency: "BRL",
      };

      const first = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "key-replay-same",
        },
        body: JSON.stringify(payload),
      });
      expect(first.status).toBe(201);
      const firstData = await parseJson(first);

      // Segundo envio idêntico
      const second = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "key-replay-same",
        },
        body: JSON.stringify(payload),
      });
      expect(second.status).toBe(200);
      const secondData = await parseJson(second);
      expect(secondData.idempotentReplay).toBe(true);
      expect(secondData.message).toContain("Replay de Idempotência");
      expect(secondData.id).toBe(firstData.id);
      expect(secondData.resultBalance).toBe(firstData.resultBalance);
    });

    it("mesma Idempotency-Key com payload divergente retorna 409 IDEMPOTENCY_CONFLICT", async () => {
      const playerId = randomUUID();
      const wallet = await parseJson(
        await fetch(`${baseUrl}/wallets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, currency: "BRL", initialBalance: "100.00" }),
        }),
      );

      const payload = {
        providerId: "provider-evolution",
        externalTransactionId: "ext-bet-conflict",
        playerId,
        walletId: wallet.id,
        roundId: "round-conflict",
        gameId: "roulette",
        kind: "BET",
        amount: "25.00",
        currency: "BRL",
      };

      const first = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "key-conflict-header",
        },
        body: JSON.stringify(payload),
      });
      expect(first.status).toBe(201);

      // Reutiliza mesma chave com payload diferente (amount 40.00)
      const second = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "key-conflict-header",
        },
        body: JSON.stringify({ ...payload, amount: "40.00" }),
      });
      expect(second.status).toBe(409);
      const err = await parseJson(second);
      expect(err.error.code).toBe("IDEMPOTENCY_CONFLICT");
    });

    it("WIN com referência inexistente retorna 202 Accepted (PENDING_REFERENCE)", async () => {
      const playerId = randomUUID();
      const wallet = await parseJson(
        await fetch(`${baseUrl}/wallets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, currency: "BRL", initialBalance: "50.00" }),
        }),
      );

      const res = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "win-pending-key",
        },
        body: JSON.stringify({
          providerId: "provider-evolution",
          externalTransactionId: "ext-win-001",
          playerId,
          walletId: wallet.id,
          roundId: "round-win",
          gameId: "slots",
          kind: "WIN",
          amount: "150.00",
          currency: "BRL",
          referenceExternalTransactionId: "ext-bet-not-yet-received",
        }),
      });

      expect(res.status).toBe(202);
      const data = await parseJson(res);
      expect(data.status).toBe("PENDING_REFERENCE");
      expect(data.resultBalance).toBeNull();
    });

    it("REFUND estorna BET e segunda tentativa de reversão retorna 422 ALREADY_REVERSED", async () => {
      const playerId = randomUUID();
      const wallet = await parseJson(
        await fetch(`${baseUrl}/wallets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, currency: "BRL", initialBalance: "100.00" }),
        }),
      );

      // 1. Processa BET de 40.00
      const betRes = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "bet-to-refund-key",
        },
        body: JSON.stringify({
          providerId: "provider-evolution",
          externalTransactionId: "ext-bet-ref-1",
          playerId,
          walletId: wallet.id,
          roundId: "round-ref",
          gameId: "roulette",
          kind: "BET",
          amount: "40.00",
          currency: "BRL",
        }),
      });
      expect(betRes.status).toBe(201);

      // Saldo após BET: 60.00
      let w = await parseJson(await fetch(`${baseUrl}/wallets/${wallet.id}`));
      expect(w.balance).toBe("60.00");

      // 2. Primeiro REFUND de 40.00 com sucesso
      const refund1 = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "refund-1-key",
        },
        body: JSON.stringify({
          providerId: "provider-evolution",
          externalTransactionId: "ext-refund-1",
          playerId,
          walletId: wallet.id,
          roundId: "round-ref",
          gameId: "roulette",
          kind: "REFUND",
          amount: "40.00",
          currency: "BRL",
          referenceExternalTransactionId: "ext-bet-ref-1",
        }),
      });
      expect(refund1.status).toBe(201);

      // Saldo restaurado: 100.00
      w = await parseJson(await fetch(`${baseUrl}/wallets/${wallet.id}`));
      expect(w.balance).toBe("100.00");

      // 3. Segundo REFUND para a mesma BET -> ALREADY_REVERSED
      const refund2 = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "refund-2-key",
        },
        body: JSON.stringify({
          providerId: "provider-evolution",
          externalTransactionId: "ext-refund-2",
          playerId,
          walletId: wallet.id,
          roundId: "round-ref",
          gameId: "roulette",
          kind: "REFUND",
          amount: "40.00",
          currency: "BRL",
          referenceExternalTransactionId: "ext-bet-ref-1",
        }),
      });
      expect(refund2.status).toBe(422);
      const err = await parseJson(refund2);
      expect(err.error.code).toBe("ALREADY_REVERSED");
      expect(err.error.message).toContain("ext-bet-ref-1");
      expect(err.error.details.referenceExternalTransactionId).toBe("ext-bet-ref-1");
      expect(err.error.details.alreadyReversedByExternalId).toBe("ext-refund-1");
      expect(err.error.details.amount).toBe("40.00");
    });
  });

  describe("GET /transactions/:id e /transactions/external/:providerId/:externalId", () => {
    it("consulta transação por ID interno ou por provider + externalId", async () => {
      const playerId = randomUUID();
      const wallet = await parseJson(
        await fetch(`${baseUrl}/wallets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, currency: "BRL", initialBalance: "50.00" }),
        }),
      );

      const createdTx = await parseJson(
        await fetch(`${baseUrl}/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "key-query-test",
          },
          body: JSON.stringify({
            providerId: "prov-query",
            externalTransactionId: "ext-query-1",
            playerId,
            walletId: wallet.id,
            roundId: "r-query",
            gameId: "g-query",
            kind: "BET",
            amount: "10.00",
            currency: "BRL",
          }),
        }),
      );

      // Consulta por ID interno
      const byId = await fetch(`${baseUrl}/transactions/${createdTx.id}`);
      expect(byId.status).toBe(200);
      const data1 = await parseJson(byId);
      expect(data1.id).toBe(createdTx.id);
      expect(data1.amount).toBe("10.00");

      // Consulta por Provider + ExternalId
      const byExternal = await fetch(
        `${baseUrl}/transactions/external/prov-query/ext-query-1`,
      );
      expect(byExternal.status).toBe(200);
      const data2 = await parseJson(byExternal);
      expect(data2.id).toBe(createdTx.id);
      expect(data2.externalTransactionId).toBe("ext-query-1");

      // Consulta transação inexistente
      const notFound = await fetch(`${baseUrl}/transactions/${randomUUID()}`);
      expect(notFound.status).toBe(404);
      const err = await parseJson(notFound);
      expect(err.error.code).toBe("TRANSACTION_NOT_FOUND");
    });
  });

  describe("GET /wallets/:id/ledger e POST /wallets/:id/reconciliation", () => {
    it("extrato contábil pagina por cursor base64 e reconciliação atesta consistência", async () => {
      const playerId = randomUUID();
      const wallet = await parseJson(
        await fetch(`${baseUrl}/wallets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, currency: "BRL", initialBalance: "100.00" }),
        }),
      );

      // Realiza 2 apostas
      await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": "rec-bet-1" },
        body: JSON.stringify({
          providerId: "p-rec",
          externalTransactionId: "e-rec-1",
          playerId,
          walletId: wallet.id,
          roundId: "r1",
          gameId: "g1",
          kind: "BET",
          amount: "20.00",
          currency: "BRL",
        }),
      });

      await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": "rec-bet-2" },
        body: JSON.stringify({
          providerId: "p-rec",
          externalTransactionId: "e-rec-2",
          playerId,
          walletId: wallet.id,
          roundId: "r2",
          gameId: "g2",
          kind: "BET",
          amount: "15.00",
          currency: "BRL",
        }),
      });

      // Total de entries: 3 (OPENING 100 + BET 20 + BET 15). Saldo = 65.00.
      // Testa paginação com limit=2
      const page1Res = await fetch(`${baseUrl}/wallets/${wallet.id}/ledger?limit=2`);
      expect(page1Res.status).toBe(200);
      const page1 = await parseJson(page1Res);
      expect(page1.items.length).toBe(2);
      expect(page1.nextCursor).not.toBeNull();

      // Próxima página usando o cursor retornado
      const page2Res = await fetch(
        `${baseUrl}/wallets/${wallet.id}/ledger?limit=2&cursor=${encodeURIComponent(page1.nextCursor)}`,
      );
      expect(page2Res.status).toBe(200);
      const page2 = await parseJson(page2Res);
      expect(page2.items.length).toBe(1);
      expect(page2.nextCursor).toBeNull();

      // Executa reconciliação contábil
      const recRes = await fetch(`${baseUrl}/wallets/${wallet.id}/reconciliation`, {
        method: "POST",
      });
      expect(recRes.status).toBe(200);
      const rec = await parseJson(recRes);
      expect(rec.walletId).toBe(wallet.id);
      expect(rec.consistent).toBe(true);
      expect(rec.storedBalance).toBe("65.00");
      expect(rec.calculatedBalance).toBe("65.00");
      expect(rec.difference).toBe("0.00");
      expect(rec.checkedEntries).toBe(3);
    });

    it("POST /wallets/:id/deposit > efetua depósito, credita saldo e responde com 201 Created e 200 OK no replay", async () => {
      const playerId = randomUUID();
      const walletRes = await fetch(`${baseUrl}/wallets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, currency: "BRL", initialBalance: "20.00" }),
      });
      expect(walletRes.status).toBe(201);
      const wallet = await parseJson(walletRes);

      // 1. Depósito sem Idempotency-Key deve falhar com 400
      const missingKeyRes = await fetch(`${baseUrl}/wallets/${wallet.id}/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: "50.00" }),
      });
      expect(missingKeyRes.status).toBe(400);

      // 2. Depósito válido de 50.00
      const depRes = await fetch(`${baseUrl}/wallets/${wallet.id}/deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "dep-integration-key-1",
        },
        body: JSON.stringify({ amount: "50.00", providerId: "PIX" }),
      });
      expect(depRes.status).toBe(201);
      const depData = await parseJson(depRes);
      expect(depData.idempotentReplay).toBe(false);
      expect(depData.amount).toBe("50.00");
      expect(depData.balanceBefore).toBe("20.00");
      expect(depData.balanceAfter).toBe("70.00");
      expect(depData.status).toBe("PROCESSED");

      // Saldo consultado deve refletir os 70.00
      const getWRes = await fetch(`${baseUrl}/wallets/${wallet.id}`);
      const getW = await parseJson(getWRes);
      expect(getW.balance).toBe("70.00");

      // 3. Replay com a mesma chave deve retornar 200 OK
      const replayRes = await fetch(`${baseUrl}/wallets/${wallet.id}/deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "dep-integration-key-1",
        },
        body: JSON.stringify({ amount: "50.00", providerId: "PIX" }),
      });
      expect(replayRes.status).toBe(200);
      const replayData = await parseJson(replayRes);
      expect(replayData.idempotentReplay).toBe(true);
      expect(replayData.message).toContain("Replay de Idempotência: este depósito já foi creditado anteriormente");

      // 4. Conflito de idempotência (mesma chave, valor diferente) -> 409
      const conflictRes = await fetch(`${baseUrl}/wallets/${wallet.id}/deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "dep-integration-key-1",
        },
        body: JSON.stringify({ amount: "100.00", providerId: "PIX" }),
      });
      expect(conflictRes.status).toBe(409);
    });
  });
});
