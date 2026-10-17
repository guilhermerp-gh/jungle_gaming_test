import { z } from "zod";

export const ProcessTransactionSchema = z.object({
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
});

export type ProcessTransactionDto = z.infer<typeof ProcessTransactionSchema>;

export interface TransactionResponseDto {
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
  referenceExternalTransactionId: string | null;
  referenceTransactionId: string | null;
  createdAt: string;
  processedAt: string | null;
  idempotentReplay?: boolean;
}
