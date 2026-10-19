/**
 * ============================================================================
 * 🧪 TESTES DE CONFORMIDADE DE CONTRATO JUNGLE GAMING & DUAL-COMPATIBILITY (FASE 11)
 * ============================================================================
 * Arquivo: test/integration/jungle-contract-compliance.test.ts
 *
 * 🎯 RESPONSABILIDADE DESTE ARQUIVO:
 * Validar rigorosamente a conformidade com as Seções 9 e 10 do Desafio Oficial
 * Jungle Gaming (junglegaming/backend-challenge), garantindo compatibilidade
 * dupla em rotas HTTP, DTOs (money vs amount/currency) e envelopes SQS,
 * sem quebrar a retrocompatibilidade com a suíte existente.
 * ============================================================================
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  CreateQueueCommand,
  DeleteQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { HttpModule } from "../../src/interfaces/http/http.module";
import { HttpExceptionFilter } from "../../src/interfaces/http/filters/http-exception.filter";
import { resetData, seedWallet, setupTestDb, type TestDb } from "../helpers/db";
import { ProcessWagerTransactionUseCase } from "../../src/application/use-cases/process-wager-transaction.use-case";
import { WagerTransactionsConsumerWorker } from "../../src/interfaces/workers/wager-transactions-consumer.worker";

const SQS_ENDPOINT = process.env.AWS_ENDPOINT_URL ?? "http://localhost:4566";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseJson(res: Response): Promise<any> {
  return res.json();
}

describe("Jungle Gaming Contract Compliance & Dual-Compatibility (Phase 11)", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let sqsClient: SQSClient;
  let testQueueUrl: string;
  let testDlqUrl: string;

  beforeAll(async () => {
    db = await setupTestDb();

    app = await NestFactory.create(
      HttpModule.register({ orm: db.orm, uow: db.uow }),
      { logger: false },
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.enableShutdownHooks();

    await app.listen(0);
    const server = app.getHttpServer();
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    sqsClient = new SQSClient({
      region: "us-east-1",
      endpoint: SQS_ENDPOINT,
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
    });

    const queueSuffix = randomUUID();
    const dlqName = `jungle-test-dlq-${queueSuffix}.fifo`;
    const queueName = `jungle-test-queue-${queueSuffix}.fifo`;

    const createDlqRes = await sqsClient.send(
      new CreateQueueCommand({
        QueueName: dlqName,
        Attributes: { FifoQueue: "true", ContentBasedDeduplication: "false" },
      }),
    );
    testDlqUrl = createDlqRes.QueueUrl!;

    const createQueueRes = await sqsClient.send(
      new CreateQueueCommand({
        QueueName: queueName,
        Attributes: { FifoQueue: "true", ContentBasedDeduplication: "false" },
      }),
    );
    testQueueUrl = createQueueRes.QueueUrl!;
  });

  afterAll(async () => {
    if (app) await app.close();
    if (db) await db.close();

    if (testQueueUrl) {
      await sqsClient.send(new DeleteQueueCommand({ QueueUrl: testQueueUrl })).catch(() => {});
    }
    if (testDlqUrl) {
      await sqsClient.send(new DeleteQueueCommand({ QueueUrl: testDlqUrl })).catch(() => {});
    }
    sqsClient.destroy();
  });

  beforeEach(async () => {
    await resetData(db);
  });

  describe("Seção 9: Rotas HTTP e Payloads Canônicos", () => {
    it("POST /wagering/transactions com objeto money: { amount, currency } processa com 201 e retorna transactionId e balance", async () => {
      const { wallet } = await seedWallet(db.uow, "100.00", "BRL");
      const extTxId = `tx-${randomUUID()}`;

      const res = await fetch(`${baseUrl}/wagering/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `key-${extTxId}`,
        },
        body: JSON.stringify({
          providerId: "evolution",
          externalTransactionId: extTxId,
          playerId: wallet.playerId,
          walletId: wallet.id,
          roundId: "round-01",
          gameId: "roulette",
          kind: "BET",
          money: { amount: "25.00", currency: "BRL" },
        }),
      });

      expect(res.status).toBe(201);
      const data = await parseJson(res);

      // Conformidade estrita Seção 9 Jungle Gaming
      expect(data.transactionId).toBeDefined();
      expect(data.id).toBe(data.transactionId);
      expect(data.status).toBe("PROCESSED");
      expect(data.idempotentReplay).toBe(false);

      // Objeto balance e resultado legado resultBalance
      expect(data.balance).toEqual({ amount: "75.00", currency: "BRL" });
      expect(data.resultBalance).toBe("75.00");
      expect(data.amount).toBe("25.00");
      expect(data.currency).toBe("BRL");
    });

    it("POST /transactions (rota legada) com campos planos amount e currency continua funcionando perfeitamente", async () => {
      const { wallet } = await seedWallet(db.uow, "100.00", "BRL");
      const extTxId = `tx-legacy-${randomUUID()}`;

      const res = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `key-${extTxId}`,
        },
        body: JSON.stringify({
          providerId: "pragmatic",
          externalTransactionId: extTxId,
          playerId: wallet.playerId,
          walletId: wallet.id,
          roundId: "round-02",
          gameId: "slots",
          kind: "BET",
          amount: "15.00",
          currency: "BRL",
        }),
      });

      expect(res.status).toBe(201);
      const data = await parseJson(res);
      expect(data.id).toBeDefined();
      expect(data.transactionId).toBe(data.id);
      expect(data.resultBalance).toBe("85.00");
      expect(data.balance).toEqual({ amount: "85.00", currency: "BRL" });
    });

    it("Replay Idempotente cruzado: submeter com money e reenviar com payload plano deve retornar 200 OK com idempotentReplay: true", async () => {
      const { wallet } = await seedWallet(db.uow, "100.00", "BRL");
      const extTxId = `tx-replay-${randomUUID()}`;
      const idempotencyKey = `idem-${extTxId}`;

      // 1. Primeira requisição usando money: { amount, currency } em /wagering/transactions
      const res1 = await fetch(`${baseUrl}/wagering/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          providerId: "evolution",
          externalTransactionId: extTxId,
          playerId: wallet.playerId,
          walletId: wallet.id,
          roundId: "round-03",
          gameId: "blackjack",
          kind: "BET",
          money: { amount: "30.00", currency: "BRL" },
        }),
      });

      expect(res1.status).toBe(201);
      const data1 = await parseJson(res1);
      expect(data1.resultBalance).toBe("70.00");
      expect(data1.idempotentReplay).toBe(false);

      // 2. Reenvio com a mesma Idempotency-Key, porém com formato plano em /transactions
      const res2 = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          providerId: "evolution",
          externalTransactionId: extTxId,
          playerId: wallet.playerId,
          walletId: wallet.id,
          roundId: "round-03",
          gameId: "blackjack",
          kind: "BET",
          amount: "30.00",
          currency: "BRL",
        }),
      });

      expect(res2.status).toBe(200);
      const data2 = await parseJson(res2);
      expect(data2.transactionId).toBe(data1.transactionId);
      expect(data2.idempotentReplay).toBe(true);
      expect(data2.resultBalance).toBe("70.00");

      // Confere que o saldo não foi debitado duas vezes
      const walletRes = await fetch(`${baseUrl}/wallets/${wallet.id}`);
      const walletData = await parseJson(walletRes);
      expect(walletData.balance).toBe("70.00");
    });

    it("GET /wagering/transactions/:transactionId e GET /transactions/:id consultam por ID interno em ambas as rotas", async () => {
      const { wallet } = await seedWallet(db.uow, "100.00", "BRL");
      const extTxId = `tx-get-${randomUUID()}`;

      const createRes = await fetch(`${baseUrl}/wagering/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `key-${extTxId}`,
        },
        body: JSON.stringify({
          providerId: "evolution",
          externalTransactionId: extTxId,
          playerId: wallet.playerId,
          walletId: wallet.id,
          roundId: "round-04",
          gameId: "roulette",
          kind: "BET",
          money: { amount: "10.00", currency: "BRL" },
        }),
      });
      const created = await parseJson(createRes);
      const txId = created.transactionId;

      // 1. Consulta pela rota oficial Jungle: GET /wagering/transactions/:transactionId
      const resOfficial = await fetch(`${baseUrl}/wagering/transactions/${txId}`);
      expect(resOfficial.status).toBe(200);
      const dataOfficial = await parseJson(resOfficial);
      expect(dataOfficial.transactionId).toBe(txId);
      expect(dataOfficial.balance).toEqual({ amount: "90.00", currency: "BRL" });

      // 2. Consulta pelo alias legado: GET /transactions/:id
      const resLegacy = await fetch(`${baseUrl}/transactions/${txId}`);
      expect(resLegacy.status).toBe(200);
      const dataLegacy = await parseJson(resLegacy);
      expect(dataLegacy.id).toBe(txId);
      expect(dataLegacy.resultBalance).toBe("90.00");
    });

    it("GET /providers/:providerId/wagering/transactions/:externalTransactionId consulta rota canônica do provedor", async () => {
      const { wallet } = await seedWallet(db.uow, "100.00", "BRL");
      const providerId = "playtech";
      const externalTxId = `pt-tx-${randomUUID()}`;

      await fetch(`${baseUrl}/wagering/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `key-${externalTxId}`,
        },
        body: JSON.stringify({
          providerId,
          externalTransactionId: externalTxId,
          playerId: wallet.playerId,
          walletId: wallet.id,
          roundId: "round-pt-1",
          gameId: "age-of-gods",
          kind: "BET",
          money: { amount: "20.00", currency: "BRL" },
        }),
      });

      // Rota canônica Jungle
      const canonicalRes = await fetch(
        `${baseUrl}/providers/${providerId}/wagering/transactions/${externalTxId}`,
      );
      expect(canonicalRes.status).toBe(200);
      const canonicalData = await parseJson(canonicalRes);
      expect(canonicalData.providerId).toBe(providerId);
      expect(canonicalData.externalTransactionId).toBe(externalTxId);
      expect(canonicalData.balance).toEqual({ amount: "80.00", currency: "BRL" });

      // Alias legado
      const legacyRes = await fetch(
        `${baseUrl}/transactions/external/${providerId}/${externalTxId}`,
      );
      expect(legacyRes.status).toBe(200);
      const legacyData = await parseJson(legacyRes);
      expect(legacyData.externalTransactionId).toBe(externalTxId);
    });

    it("POST /wallets com initialBalance: { amount, currency } cria carteira com saldo e ledger OPENING", async () => {
      const playerId = randomUUID();
      const res = await fetch(`${baseUrl}/wallets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          initialBalance: { amount: "250.00", currency: "BRL" },
        }),
      });

      expect(res.status).toBe(201);
      const data = await parseJson(res);
      expect(data.playerId).toBe(playerId);
      expect(data.currency).toBe("BRL");
      expect(data.balance).toBe("250.00");
      expect(data.money).toEqual({ amount: "250.00", currency: "BRL" });

      // Verifica lançamento contábil no ledger
      const ledgerRes = await fetch(`${baseUrl}/wallets/${data.id}/ledger`);
      expect(ledgerRes.status).toBe(200);
      const ledger = await parseJson(ledgerRes);
      expect(ledger.items.length).toBe(1);
      expect(ledger.items[0].direction).toBe("CREDIT");
      expect(ledger.items[0].amount).toBe("250.00");
    });
  });

  describe("Seção 10: Consumo de Mensagens SQS com Envelope Jungle Gaming", () => {
    it("Consome mensagem SQS encapsulada em { type: 'WagerTransactionRequested', data: { ... } }", async () => {
      const { wallet } = await seedWallet(db.uow, "100.00", "BRL");
      const extTxId = `sqs-tx-${randomUUID()}`;
      const idempotencyKey = `sqs-key-${extTxId}`;

      const envelopeJungle = {
        messageId: `msg-${randomUUID()}`,
        type: "WagerTransactionRequested",
        occurredAt: new Date().toISOString(),
        data: {
          providerId: "provider-sqs",
          externalTransactionId: extTxId,
          idempotencyKey,
          playerId: wallet.playerId,
          walletId: wallet.id,
          roundId: "round-sqs-01",
          gameId: "fortune-ox",
          kind: "BET",
          money: { amount: "35.00", currency: "BRL" },
        },
      };

      // Envia para o SQS LocalStack
      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: testQueueUrl,
          MessageBody: JSON.stringify(envelopeJungle),
          MessageGroupId: wallet.id,
          MessageDeduplicationId: randomUUID(),
        }),
      );

      // Instancia worker apontando para a fila de teste
      const useCase = new ProcessWagerTransactionUseCase(db.uow);
      const worker = new WagerTransactionsConsumerWorker(useCase, {
        queueUrl: testQueueUrl,
        dlqUrl: testDlqUrl,
        sqsClient,
        waitTimeSeconds: 1,
        pollIntervalMs: 50,
      });

      const processedCount = await worker.pollOnce();
      expect(processedCount).toBe(1);

      // Verifica no banco de dados que a transação foi processada com sucesso
      const tx = await db.uow.transactional((r) => r.wagers.findByIdempotencyKey(idempotencyKey));
      expect(tx).not.toBeNull();
      expect(tx?.status).toBe("PROCESSED");
      expect(tx?.props.resultBalance?.amount).toBe("65.00");

      // Verifica que a carteira teve o saldo debitado
      const updatedWallet = await db.uow.transactional((r) => r.wallets.findById(wallet.id));
      expect(updatedWallet?.balance.amount).toBe("65.00");

      // Verifica que a mensagem foi removida da fila SQS (DeleteMessage / Ack)
      const sqsCheck = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: testQueueUrl,
          WaitTimeSeconds: 1,
          MaxNumberOfMessages: 1,
        }),
      );
      expect(sqsCheck.Messages ?? []).toHaveLength(0);
    });
  });
});
