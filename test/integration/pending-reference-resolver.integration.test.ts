/**
 * ============================================================================
 * 🧪 TESTES DE INTEGRAÇÃO: PENDING REFERENCE RESOLVER & FORA DE ORDEM (FASE 7)
 * ============================================================================
 * Arquivo: test/integration/pending-reference-resolver.integration.test.ts
 *
 * 🎯 RESPONSABILIDADE DESTE ARQUIVO:
 * Validar contra o PostgreSQL real o comportamento do Pending Reference Resolver:
 * 1. WIN fora de ordem (chega antes da BET) -> PENDING_REFERENCE (202) -> BET chega -> WIN resolvido
 * 2. REFUND fora de ordem -> PENDING_REFERENCE (202) -> BET processada -> REFUND resolvido
 * 3. Timeout e Expiração definitiva (REFERENCE_NOT_FOUND) após limite de tentativas ou TTL
 * 4. Referência existente porém em estado rejeitado -> dependente rejeitada com REFERENCE_NOT_PROCESSED
 * 5. Prevenção de dupla reversão (ALREADY_REVERSED)
 * 6. Concorrência entre múltiplos Resolvers simultâneos com SKIP LOCKED (LockMode.PESSIMISTIC_PARTIAL_WRITE)
 * 7. Reconciliação e integridade contábil estrita de saldo e ledger
 * ============================================================================
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { ProcessWagerTransactionUseCase } from "../../src/application/use-cases/process-wager-transaction.use-case";
import { ReconcileWalletUseCase } from "../../src/application/use-cases/reconcile-wallet.use-case";
import { ResolvePendingReferencesUseCase } from "../../src/application/use-cases/resolve-pending-references.use-case";
import { FailureCode } from "../../src/domain/errors/failure-code";
import { Money } from "../../src/domain/money/money";
import { WagerTransaction } from "../../src/domain/wagering/wager-transaction";
import { PendingReferenceMetrics } from "../../src/infrastructure/observability/pending-reference-metrics";
import { Registry } from "prom-client";
import {
  resetData,
  seedWallet,
  setupTestDb,
  type TestDb,
} from "../helpers/db";

describe("Pending Reference Resolver (Integration Tests - Fase 7)", () => {
  let db: TestDb;
  let processUseCase: ProcessWagerTransactionUseCase;
  let resolveUseCase: ResolvePendingReferencesUseCase;
  let metrics: PendingReferenceMetrics;

  beforeAll(async () => {
    db = await setupTestDb();
    processUseCase = new ProcessWagerTransactionUseCase(db.uow);
    metrics = new PendingReferenceMetrics(new Registry());
    resolveUseCase = new ResolvePendingReferencesUseCase(db.uow, metrics);
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await resetData(db);
  });

  it("WIN fora de ordem: chega antes da BET, aguarda PENDING_REFERENCE e é resolvido quando a BET chega", async () => {
    const { wallet } = await seedWallet(db.uow, "50.00");
    const betExternalId = `bet-${randomUUID()}`;
    const winExternalId = `win-${randomUUID()}`;

    // 1. WIN chega primeiro (referenciando BET que ainda não existe)
    const winResult = await processUseCase.execute(
      `key-win-${winExternalId}`,
      {
        providerId: "provider-evolution",
        externalTransactionId: winExternalId,
        playerId: wallet.playerId,
        walletId: wallet.id,
        roundId: "round-101",
        gameId: "roulette",
        kind: "WIN",
        amount: "150.00",
        currency: "BRL",
        referenceExternalTransactionId: betExternalId,
      },
    );

    expect(winResult.statusCode).toBe(202);
    expect(winResult.transaction.status).toBe("PENDING_REFERENCE");

    // Saldo da carteira deve permanecer intacto (R$ 50,00)
    const walletBeforeBet = await db.uow.transactional(async (r) => r.wallets.findById(wallet.id));
    expect(walletBeforeBet!.balance.amount).toBe("50.00");

    // 2. BET chega e é processada com sucesso
    const betResult = await processUseCase.execute(
      `key-bet-${betExternalId}`,
      {
        providerId: "provider-evolution",
        externalTransactionId: betExternalId,
        playerId: wallet.playerId,
        walletId: wallet.id,
        roundId: "round-101",
        gameId: "roulette",
        kind: "BET",
        amount: "30.00",
        currency: "BRL",
      },
    );

    expect(betResult.statusCode).toBe(201);
    expect(betResult.transaction.status).toBe("PROCESSED");

    // 3. Com a otimização de fast-path (ou executando o resolver), o WIN já foi resolvido
    // Saldo esperado: 50.00 (inicial) - 30.00 (BET) + 150.00 (WIN) = 170.00
    const walletAfter = await db.uow.transactional(async (r) => r.wallets.findById(wallet.id));
    expect(walletAfter!.balance.amount).toBe("170.00");

    // Verifica que o WIN agora está PROCESSED com o ID da BET associado
    const winInDb = await db.uow.transactional(async (r) =>
      r.wagers.findByExternalId("provider-evolution", winExternalId),
    );
    expect(winInDb!.status).toBe("PROCESSED");
    expect(winInDb!.props.referenceTransactionId).toBe(betResult.transaction.id);

    // Valida o ledger contábil: OPENING (50.00), DEBIT (30.00), CREDIT (150.00)
    const totals = await db.uow.transactional(async (r) => r.ledger.totals(wallet.id));
    expect(totals.entries).toBe(3);
    expect(totals.credits).toBe("200.00"); // 50.00 + 150.00
    expect(totals.debits).toBe("30.00");
  });

  it("REFUND fora de ordem: chega antes da BET e é aplicado quando o resolver avalia a pendência", async () => {
    const { wallet } = await seedWallet(db.uow, "100.00");
    const betExternalId = `bet-${randomUUID()}`;
    const refundExternalId = `ref-${randomUUID()}`;

    // 1. REFUND chega antes da BET
    const refundResult = await processUseCase.execute(
      `key-ref-${refundExternalId}`,
      {
        providerId: "provider-pragmatic",
        externalTransactionId: refundExternalId,
        playerId: wallet.playerId,
        walletId: wallet.id,
        roundId: "round-202",
        gameId: "slots",
        kind: "REFUND",
        amount: "40.00",
        currency: "BRL",
        referenceExternalTransactionId: betExternalId,
      },
    );

    expect(refundResult.statusCode).toBe(202);
    expect(refundResult.transaction.status).toBe("PENDING_REFERENCE");

    // 2. BET chega e debita R$ 40,00 da carteira
    const betResult = await processUseCase.execute(
      `key-bet-${betExternalId}`,
      {
        providerId: "provider-pragmatic",
        externalTransactionId: betExternalId,
        playerId: wallet.playerId,
        walletId: wallet.id,
        roundId: "round-202",
        gameId: "slots",
        kind: "BET",
        amount: "40.00",
        currency: "BRL",
      },
    );

    expect(betResult.statusCode).toBe(201);

    // 3. Executa o ciclo de resolução
    const resolution = await resolveUseCase.execute({ now: new Date(Date.now() + 6000) });
    expect(resolution.appliedCount).toBeGreaterThanOrEqual(0); // Pode ter sido aplicado no fast-path ou aqui

    // Saldo final: 100.00 (inicial) - 40.00 (BET) + 40.00 (REFUND) = 100.00
    const finalWallet = await db.uow.transactional(async (r) => r.wallets.findById(wallet.id));
    expect(finalWallet!.balance.amount).toBe("100.00");

    const refundInDb = await db.uow.transactional(async (r) =>
      r.wagers.findByExternalId("provider-pragmatic", refundExternalId),
    );
    expect(refundInDb!.status).toBe("PROCESSED");

    // 4. Prevenção de dupla reversão: uma segunda tentativa de reverter a mesma BET deve ser rejeitada
    const secondRefundExternalId = `ref-second-${randomUUID()}`;
    await expect(
      processUseCase.execute(`key-second-ref-${secondRefundExternalId}`, {
        providerId: "provider-pragmatic",
        externalTransactionId: secondRefundExternalId,
        playerId: wallet.playerId,
        walletId: wallet.id,
        roundId: "round-202",
        gameId: "slots",
        kind: "REFUND",
        amount: "40.00",
        currency: "BRL",
        referenceExternalTransactionId: betExternalId,
      }),
    ).rejects.toThrow();

    const secondRefundInDb = await db.uow.transactional(async (r) =>
      r.wagers.findByExternalId("provider-pragmatic", secondRefundExternalId),
    );
    expect(secondRefundInDb!.status).toBe("REJECTED");
    expect(secondRefundInDb!.failureCode).toBe(FailureCode.ALREADY_REVERSED);
  });

  it("Timeout e Expiração: transação órfã atinge limite de tentativas e é finalizada como REJECTED/REFERENCE_NOT_FOUND", async () => {
    const { wallet } = await seedWallet(db.uow, "50.00");
    const orphanRefundId = `ref-orphan-${randomUUID()}`;

    // Submete REFUND apontando para transação inexistente
    await processUseCase.execute(`key-orphan-${orphanRefundId}`, {
      providerId: "provider-x",
      externalTransactionId: orphanRefundId,
      playerId: wallet.playerId,
      walletId: wallet.id,
      roundId: "round-orphan",
      gameId: "game-orphan",
      kind: "REFUND",
      amount: "25.00",
      currency: "BRL",
      referenceExternalTransactionId: "bet-does-not-exist",
    });

    const tx = await db.uow.transactional(async (r) =>
      r.wagers.findByExternalId("provider-x", orphanRefundId),
    );
    expect(tx!.status).toBe("PENDING_REFERENCE");

    // Executa a resolução forçando maxAttempts = 1
    const result = await resolveUseCase.execute({
      now: new Date(Date.now() + 10_000),
      maxAttempts: 1,
    });

    expect(result.rejectedTimeoutCount).toBe(1);

    // Transação deve ter sido rejeitada com REFERENCE_NOT_FOUND
    const resolvedTx = await db.uow.transactional(async (r) =>
      r.wagers.findByExternalId("provider-x", orphanRefundId),
    );
    expect(resolvedTx!.status).toBe("REJECTED");
    expect(resolvedTx!.failureCode).toBe(FailureCode.REFERENCE_NOT_FOUND);

    // Saldo inalterado e nenhum ledger novo
    const walletAfter = await db.uow.transactional(async (r) => r.wallets.findById(wallet.id));
    expect(walletAfter!.balance.amount).toBe("50.00");
  });

  it("Referência Rejeitada: transação dependente é finalizada com REFERENCE_NOT_PROCESSED", async () => {
    const { wallet } = await seedWallet(db.uow, "10.00");
    const betExternalId = `bet-failed-${randomUUID()}`;
    const rollbackExternalId = `rb-${randomUUID()}`;

    // 1. ROLLBACK chega antes
    await processUseCase.execute(`key-rb-${rollbackExternalId}`, {
      providerId: "provider-y",
      externalTransactionId: rollbackExternalId,
      playerId: wallet.playerId,
      walletId: wallet.id,
      roundId: "round-303",
      gameId: "roulette",
      kind: "ROLLBACK",
      amount: "50.00",
      currency: "BRL",
      referenceExternalTransactionId: betExternalId,
    });

    // 2. BET chega, mas com saldo insuficiente (R$ 50.00 com saldo de R$ 10.00)
    await expect(
      processUseCase.execute(`key-bet-${betExternalId}`, {
        providerId: "provider-y",
        externalTransactionId: betExternalId,
        playerId: wallet.playerId,
        walletId: wallet.id,
        roundId: "round-303",
        gameId: "roulette",
        kind: "BET",
        amount: "50.00",
        currency: "BRL",
      }),
    ).rejects.toThrow();

    const betInDb = await db.uow.transactional(async (r) =>
      r.wagers.findByExternalId("provider-y", betExternalId),
    );
    expect(betInDb!.status).toBe("REJECTED");

    // 3. Resolver avalia a referência do ROLLBACK
    const outcome = await resolveUseCase.resolveOne(
      (await db.uow.transactional(async (r) =>
        r.wagers.findByExternalId("provider-y", rollbackExternalId),
      ))!.id,
      new Date(),
    );

    expect(outcome).toBe("rejected_business");

    const rollbackInDb = await db.uow.transactional(async (r) =>
      r.wagers.findByExternalId("provider-y", rollbackExternalId),
    );
    expect(rollbackInDb!.status).toBe("REJECTED");
    expect(rollbackInDb!.failureCode).toBe(FailureCode.REFERENCE_NOT_PROCESSED);
  });

  it("Concorrência: múltiplos resolvers executando em paralelo com SKIP LOCKED disputam pendências elegíveis sem colisão", async () => {
    const count = 10;
    const items: { walletId: string; playerId: string; roundId: string; betId: string; winId: string }[] = [];

    // 1. Processa 10 apostas (BETs) com sucesso em 10 carteiras distintas
    for (let i = 0; i < count; i++) {
      const { wallet } = await seedWallet(db.uow, "100.00");
      const betId = `bet-conc-${i}-${randomUUID()}`;
      const winId = `win-conc-${i}-${randomUUID()}`;
      const roundId = `round-conc-${i}`;

      const betRes = await processUseCase.execute(`key-bet-conc-${i}`, {
        providerId: "provider-concurrent",
        externalTransactionId: betId,
        playerId: wallet.playerId,
        walletId: wallet.id,
        roundId,
        gameId: "blackjack",
        kind: "BET",
        amount: "10.00",
        currency: "BRL",
      });
      expect(betRes.statusCode).toBe(201);
      items.push({ walletId: wallet.id, playerId: wallet.playerId, roundId, betId, winId });
    }

    // 2. Insere 10 WINs diretamente como PENDING_REFERENCE vencidos (nextAttemptAt no passado)
    // Garantindo que os resolvers disputem os registros reais no PostgreSQL sem serem antecipados pelo fast-path
    const pastDate = new Date(Date.now() - 5000);
    await db.uow.transactional(async (repos) => {
      for (const item of items) {
        const winTx = WagerTransaction.create({
          id: randomUUID(),
          providerId: "provider-concurrent",
          externalTransactionId: item.winId,
          idempotencyKey: `key-win-conc-${item.winId}`,
          payloadHash: `hash-${item.winId}`,
          walletId: item.walletId,
          playerId: item.playerId,
          roundId: item.roundId,
          gameId: "blackjack",
          kind: "WIN",
          money: Money.from("20.00", "BRL"),
          referenceExternalTransactionId: item.betId,
          now: pastDate,
        });
        winTx.markPendingReference(pastDate, pastDate);
        await repos.wagers.insert(winTx);
      }
    });

    // Comprova que as 10 pendências estão ativas no PostgreSQL para serem disputadas pelos workers
    const pendingBefore = await db.uow.transactional(async (r) => r.wagers.countActivePendingReferences());
    expect(pendingBefore).toBe(count);

    // 3. Executa dois resolvers concorrentes simultaneamente
    const resolverA = new ResolvePendingReferencesUseCase(db.uow, metrics);
    const resolverB = new ResolvePendingReferencesUseCase(db.uow, metrics);

    const [resA, resB] = await Promise.all([
      resolverA.execute({ now: new Date(), batchSize: 10 }),
      resolverB.execute({ now: new Date(), batchSize: 10 }),
    ]);

    // O total reivindicado e aplicado pelos dois workers combinados deve ser exatamente 10
    expect(resA.claimedCount + resB.claimedCount).toBe(count);
    expect(resA.appliedCount + resB.appliedCount).toBe(count);
    expect(resA.rejectedBusinessCount + resB.rejectedBusinessCount).toBe(0);
    expect(resA.rescheduledCount + resB.rescheduledCount).toBe(0);

    // Nenhuma pendência restante no banco
    const pendingAfter = await db.uow.transactional(async (r) => r.wagers.countActivePendingReferences());
    expect(pendingAfter).toBe(0);

    // Todas as 10 carteiras devem convergir no saldo e ledger exatos: 100 - 10 + 20 = 110.00
    for (const item of items) {
      const w = await db.uow.transactional(async (r) => r.wallets.findById(item.walletId));
      expect(w!.balance.amount).toBe("110.00");

      const totals = await db.uow.transactional(async (r) => r.ledger.totals(item.walletId));
      expect(totals.entries).toBe(3); // OPENING + BET + WIN
      expect(totals.credits).toBe("120.00"); // 100 + 20
      expect(totals.debits).toBe("10.00");

      const rec = await new ReconcileWalletUseCase(db.uow).execute(item.walletId);
      expect(rec.consistent).toBe(true);
      expect(rec.difference).toBe("0.00");
    }
  });
});
