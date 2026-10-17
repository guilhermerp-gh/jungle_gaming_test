import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  ProcessTransactionSchema,
  type ProcessTransactionDto,
  type TransactionResponseDto,
} from "../../../application/dto";
import {
  GetTransactionUseCase,
  ProcessWagerTransactionUseCase,
} from "../../../application/use-cases";
import { DomainError } from "../../../domain/errors/domain-error";
import { FailureCode } from "../../../domain/errors/failure-code";
import { AuthGuard } from "../guards/auth.guard";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller("transactions")
@UseGuards(AuthGuard)
export class TransactionsController {
  constructor(
    private readonly processTransactionUseCase: ProcessWagerTransactionUseCase,
    private readonly getTransactionUseCase: GetTransactionUseCase,
  ) {}

  @Post()
  async process(
    @Headers("idempotency-key") idempotencyKeyHeader: string | undefined,
    @Body(new ZodValidationPipe(ProcessTransactionSchema)) dto: ProcessTransactionDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TransactionResponseDto> {
    if (!idempotencyKeyHeader || idempotencyKeyHeader.trim().length === 0) {
      throw new DomainError(
        FailureCode.INVALID_PAYLOAD,
        "Missing Idempotency-Key header",
      );
    }

    const result = await this.processTransactionUseCase.execute(
      idempotencyKeyHeader.trim(),
      dto,
    );

    res.status(result.statusCode);

    return {
      idempotentReplay: result.idempotentReplay,
      ...result.transaction,
    };
  }

  @Get(":id")
  async getById(@Param("id") id: string): Promise<TransactionResponseDto> {
    if (!UUID_RE.test(id)) {
      throw new DomainError(
        FailureCode.INVALID_PAYLOAD,
        "Invalid transactionId: must be a valid UUID",
      );
    }
    return this.getTransactionUseCase.execute({ id });
  }

  @Get("external/:providerId/:externalId")
  async getByExternal(
    @Param("providerId") providerId: string,
    @Param("externalId") externalId: string,
  ): Promise<TransactionResponseDto> {
    if (!providerId || !externalId) {
      throw new DomainError(
        FailureCode.INVALID_PAYLOAD,
        "providerId and externalId are required",
      );
    }
    return this.getTransactionUseCase.execute({
      providerId,
      externalTransactionId: externalId,
    });
  }
}
