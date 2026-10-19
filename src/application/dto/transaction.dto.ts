import { z } from "zod";

export const ProcessTransactionSchema = z.preprocess(
  (val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const raw = { ...(val as Record<string, unknown>) };
      if (raw.money && typeof raw.money === "object" && !Array.isArray(raw.money)) {
        const moneyObj = raw.money as Record<string, unknown>;
        if (raw.amount === undefined && moneyObj.amount !== undefined) {
          raw.amount =
            typeof moneyObj.amount === "number"
              ? moneyObj.amount.toFixed(2)
              : String(moneyObj.amount);
        }
        if (raw.currency === undefined && moneyObj.currency !== undefined) {
          raw.currency = String(moneyObj.currency);
        }
      } else if (typeof raw.amount === "number") {
        raw.amount = (raw.amount as number).toFixed(2);
      }
      return raw;
    }
    return val;
  },
  z.object({
    providerId: z.string().min(1, { message: "providerId is required" }),
    externalTransactionId: z.string().min(1, { message: "externalTransactionId is required" }),
    playerId: z.string().uuid({ message: "playerId must be a valid UUID" }),
    walletId: z.string().uuid({ message: "walletId must be a valid UUID" }),
    roundId: z.string().min(1, { message: "roundId is required" }),
    gameId: z.string().min(1, { message: "gameId is required" }),
    kind: z.enum(["BET", "WIN", "LOSS", "REFUND", "ROLLBACK"], {
      message: "kind must be one of BET, WIN, LOSS, REFUND, ROLLBACK",
    }),
    amount: z.string().regex(/^\d+\.\d{2}$/, {
      message: "amount must be a decimal string with scale 2",
    }),
    currency: z.string().regex(/^[A-Z]{3}$/, {
      message: "currency must be 3 uppercase letters",
    }),
    referenceExternalTransactionId: z.string().min(1).nullish(),
  }),
);

export type ProcessTransactionDto = z.infer<typeof ProcessTransactionSchema>;

export interface TransactionResponseDto {
  transactionId: string;
  id: string;
  providerId: string;
  externalTransactionId: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: string;
  amount: string;
  currency: string;
  status: string;
  failureCode: string | null;
  resultBalance: string | null;
  balance: {
    amount: string;
    currency: string;
  } | null;
  referenceExternalTransactionId: string | null;
  referenceTransactionId: string | null;
  createdAt: string;
  processedAt: string | null;
  idempotentReplay?: boolean;
  message?: string;
}
