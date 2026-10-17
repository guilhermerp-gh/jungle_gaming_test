import { describe, expect, test } from "bun:test";
import { canonicalJson, computePayloadHash } from "../../src/domain/wagering/payload-hash";

const base = {
  providerId: "p", externalTransactionId: "e", playerId: "pl", walletId: "w", roundId: "r", gameId: "g",
  kind: "BET", money: { amount: "10.00", currency: "BRL" }, referenceExternalTransactionId: null,
};

describe("payloadHash", () => {
  test("estável independente da ordem das chaves", () => {
    expect(canonicalJson({ b: 1, a: { d: 1, c: 2 } })).toBe(canonicalJson({ a: { c: 2, d: 1 }, b: 1 }));
    const reordered = { ...base, money: { currency: "BRL", amount: "10.00" } };
    expect(computePayloadHash(reordered)).toBe(computePayloadHash(base));
    expect(computePayloadHash(base)).toHaveLength(64);
  });
  test("payload divergente → hash diferente", () => {
    expect(computePayloadHash({ ...base, money: { amount: "11.00", currency: "BRL" } })).not.toBe(computePayloadHash(base));
  });
});
