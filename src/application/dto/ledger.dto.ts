import { z } from "zod";

export const GetLedgerQuerySchema = z.object({
  limit: z
    .union([z.string().regex(/^\d+$/).transform(Number), z.number()])
    .optional()
    .default(20),
  cursor: z.string().optional(),
});

export type GetLedgerQueryDto = z.infer<typeof GetLedgerQuerySchema>;

export interface LedgerEntryItemDto {
  id: string;
  transactionId: string;
  direction: "CREDIT" | "DEBIT";
  amount: string;
  currency: string;
  balanceBefore: string;
  balanceAfter: string;
  createdAt: string;
}

export interface LedgerPageDto {
  items: LedgerEntryItemDto[];
  nextCursor: string | null;
}
