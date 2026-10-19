import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { ProcessTransactionSchema } from "../../src/application/dto/transaction.dto";
import { CreateWalletSchema } from "../../src/application/dto/wallet.dto";
import { computePayloadHash } from "../../src/domain/wagering/payload-hash";
import { WagerMessagePayloadSchema } from "../../src/interfaces/workers/wager-transactions-consumer.worker";

describe("DTOs & Schemas — Dual-Compatibility (Unit Tests)", () => {
  const playerId = randomUUID();
  const walletId = randomUUID();

  describe("ProcessTransactionSchema", () => {
    it("valida payload legado com campos planos amount e currency", () => {
      const parsed = ProcessTransactionSchema.parse({
        providerId: "evolution",
        externalTransactionId: "ext-1",
        playerId,
        walletId,
        roundId: "r1",
        gameId: "g1",
        kind: "BET",
        amount: "50.00",
        currency: "BRL",
      });

      expect(parsed.amount).toBe("50.00");
      expect(parsed.currency).toBe("BRL");
      expect(parsed.providerId).toBe("evolution");
    });

    it("valida e normaliza payload oficial Jungle Gaming com money: { amount, currency }", () => {
      const parsed = ProcessTransactionSchema.parse({
        providerId: "evolution",
        externalTransactionId: "ext-1",
        playerId,
        walletId,
        roundId: "r1",
        gameId: "g1",
        kind: "BET",
        money: { amount: "50.00", currency: "BRL" },
      });

      expect(parsed.amount).toBe("50.00");
      expect(parsed.currency).toBe("BRL");
    });

    it("assegura que o hash canônico seja idêntico para payload plano e payload com money", () => {
      const flatDto = ProcessTransactionSchema.parse({
        providerId: "evolution",
        externalTransactionId: "ext-same",
        playerId,
        walletId,
        roundId: "r1",
        gameId: "g1",
        kind: "BET",
        amount: "75.00",
        currency: "BRL",
      });

      const nestedDto = ProcessTransactionSchema.parse({
        providerId: "evolution",
        externalTransactionId: "ext-same",
        playerId,
        walletId,
        roundId: "r1",
        gameId: "g1",
        kind: "BET",
        money: { amount: "75.00", currency: "BRL" },
      });

      const hash1 = computePayloadHash({
        providerId: flatDto.providerId,
        externalTransactionId: flatDto.externalTransactionId,
        playerId: flatDto.playerId,
        walletId: flatDto.walletId,
        roundId: flatDto.roundId,
        gameId: flatDto.gameId,
        kind: flatDto.kind,
        money: { amount: flatDto.amount, currency: flatDto.currency },
        referenceExternalTransactionId: flatDto.referenceExternalTransactionId ?? null,
      });

      const hash2 = computePayloadHash({
        providerId: nestedDto.providerId,
        externalTransactionId: nestedDto.externalTransactionId,
        playerId: nestedDto.playerId,
        walletId: nestedDto.walletId,
        roundId: nestedDto.roundId,
        gameId: nestedDto.gameId,
        kind: nestedDto.kind,
        money: { amount: nestedDto.amount, currency: nestedDto.currency },
        referenceExternalTransactionId: nestedDto.referenceExternalTransactionId ?? null,
      });

      expect(hash1).toBe(hash2);
    });

    it("rejeita quando nem amount nem money forem informados", () => {
      const result = ProcessTransactionSchema.safeParse({
        providerId: "evolution",
        externalTransactionId: "ext-1",
        playerId,
        walletId,
        roundId: "r1",
        gameId: "g1",
        kind: "BET",
        currency: "BRL",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("CreateWalletSchema", () => {
    it("valida formato legado com initialBalance como string decimal", () => {
      const parsed = CreateWalletSchema.parse({
        playerId,
        currency: "BRL",
        initialBalance: "150.00",
      });
      expect(parsed.playerId).toBe(playerId);
      expect(parsed.currency).toBe("BRL");
      expect(parsed.initialBalance).toBe("150.00");
    });

    it("valida formato com initialBalance como objeto { amount, currency }", () => {
      const parsed = CreateWalletSchema.parse({
        playerId,
        initialBalance: { amount: "200.00", currency: "BRL" },
      });
      expect(parsed.playerId).toBe(playerId);
      expect(parsed.currency).toBe("BRL");
      expect(parsed.initialBalance).toBe("200.00");
    });
  });

  describe("WagerMessagePayloadSchema (SQS)", () => {
    it("valida e desempacota envelope Jungle { type: 'WagerTransactionRequested', data: { ... } }", () => {
      const parsed = WagerMessagePayloadSchema.parse({
        messageId: "msg-123",
        type: "WagerTransactionRequested",
        occurredAt: new Date().toISOString(),
        data: {
          providerId: "provider-sqs",
          externalTransactionId: "tx-sqs-001",
          idempotencyKey: "key-sqs-001",
          playerId,
          walletId,
          roundId: "round-01",
          gameId: "fortune-tiger",
          kind: "BET",
          money: { amount: "50.00", currency: "BRL" },
        },
      });

      expect(parsed.providerId).toBe("provider-sqs");
      expect(parsed.externalTransactionId).toBe("tx-sqs-001");
      expect(parsed.idempotencyKey).toBe("key-sqs-001");
      expect(parsed.amount).toBe("50.00");
      expect(parsed.currency).toBe("BRL");
    });

    it("infere idempotencyKey a partir de providerId:externalTransactionId se omitida no envelope", () => {
      const parsed = WagerMessagePayloadSchema.parse({
        type: "WagerTransactionRequested",
        data: {
          providerId: "provider-sqs",
          externalTransactionId: "tx-sqs-002",
          playerId,
          walletId,
          roundId: "round-01",
          gameId: "slots",
          kind: "BET",
          money: { amount: "10.00", currency: "BRL" },
        },
      });

      expect(parsed.idempotencyKey).toBe("provider-sqs:tx-sqs-002");
    });
  });
});
