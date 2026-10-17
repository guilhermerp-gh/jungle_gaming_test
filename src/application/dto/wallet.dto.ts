import { z } from "zod";

export const CreateWalletSchema = z.object({
  playerId: z.string().uuid({ message: "playerId must be a valid UUID" }),
  currency: z.string().regex(/^[A-Z]{3}$/, { message: "currency must be 3 uppercase letters" }),
  initialBalance: z
    .string()
    .regex(/^\d+\.\d{2}$/, { message: "initialBalance must be a decimal string with scale 2" })
    .optional()
    .default("0.00"),
});

export type CreateWalletDto = z.infer<typeof CreateWalletSchema>;

export interface WalletResponseDto {
  id: string;
  playerId: string;
  currency: string;
  balance: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
