import { describe, expect, test } from "bun:test";
import { Money } from "../../src/domain/money/money";

describe("Money", () => {
  test("escala fixa 2 e soma exata", () => {
    expect(Money.from("0.10", "BRL").add(Money.from("0.20", "BRL")).amount).toBe("0.30");
    expect(Money.from("5", "BRL").amount).toBe("5.00");
    expect(Money.from("5.5", "BRL").amount).toBe("5.50");
  });
  test.each(["NaN", "Infinity", "1e3", "", "1.234", "-1.00", " 1", "1,00"])("rejeita %p", (v) => {
    expect(() => Money.from(v, "BRL")).toThrow();
  });
  test("rejeita number em runtime", () => {
    expect(() => Money.from(10 as unknown as string, "BRL")).toThrow();
  });
  test("conflito de moeda", () => {
    expect(() => Money.from("1", "BRL").add(Money.from("1", "USD"))).toThrow();
  });
  test("subtração negativa falha", () => {
    expect(() => Money.from("1", "BRL").subtract(Money.from("2", "BRL"))).toThrow();
  });
  test("imutável", () => {
    const m = Money.from("1", "BRL");
    m.add(Money.from("1", "BRL"));
    expect(m.amount).toBe("1.00");
    expect(Object.isFrozen(m)).toBe(true);
  });
});
