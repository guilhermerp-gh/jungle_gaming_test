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
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
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

@ApiTags("transactions")
@Controller("transactions")
@UseGuards(AuthGuard)
export class TransactionsController {
  constructor(
    private readonly processTransactionUseCase: ProcessWagerTransactionUseCase,
    private readonly getTransactionUseCase: GetTransactionUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Processar transação de aposta",
    description:
      "Processa apostas (BET), ganhos (WIN), perdas (LOSS), estornos (REFUND) e cancelamentos (ROLLBACK) com garantia de idempotência persistente e lock pessimista por linha.",
  })
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Identificador único da requisição para prevenção de duplicação",
    example: "req-bet-001",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: [
        "providerId",
        "externalTransactionId",
        "playerId",
        "walletId",
        "roundId",
        "gameId",
        "kind",
        "amount",
        "currency",
      ],
      properties: {
        providerId: { type: "string", example: "evolution" },
        externalTransactionId: { type: "string", example: "tx-ext-001" },
        playerId: { type: "string", format: "uuid", example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
        walletId: { type: "string", format: "uuid", example: "4a89972f-1ac6-4cf8-949f-c8c9605baf27" },
        roundId: { type: "string", example: "round-1" },
        gameId: { type: "string", example: "roulette" },
        kind: {
          type: "string",
          enum: ["BET", "WIN", "LOSS", "REFUND", "ROLLBACK"],
          example: "BET",
        },
        amount: { type: "string", example: "30.00" },
        currency: { type: "string", example: "BRL" },
        referenceExternalTransactionId: {
          type: "string",
          nullable: true,
          example: null,
          description: "Obrigatório para REFUND e ROLLBACK; opcional para WIN",
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: "Transação criada e processada com sucesso" })
  @ApiResponse({ status: 200, description: "Replay idempotente: retorna snapshot previamente processado" })
  @ApiResponse({ status: 202, description: "Aceita com referência pendente (PENDING_REFERENCE)" })
  @ApiResponse({ status: 400, description: "Header Idempotency-Key ausente ou payload inválido" })
  @ApiResponse({ status: 404, description: "Carteira não encontrada" })
  @ApiResponse({ status: 409, description: "Conflito de idempotência (mesma chave com payload divergente)" })
  @ApiResponse({ status: 422, description: "Rejeição de negócio (ex.: INSUFFICIENT_FUNDS, ALREADY_REVERSED)" })
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
  @ApiOperation({
    summary: "Consultar transação por ID interno",
    description: "Retorna o status atual, valores e metadados de uma transação pelo seu UUID interno.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "UUID da transação" })
  @ApiResponse({ status: 200, description: "Dados da transação" })
  @ApiResponse({ status: 404, description: "Transação não encontrada" })
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
  @ApiOperation({
    summary: "Consultar transação por ID externo do provedor",
    description: "Permite que provedores consultem o status de suas transações utilizando seus próprios IDs externos.",
  })
  @ApiParam({ name: "providerId", example: "evolution", description: "Identificador do provedor" })
  @ApiParam({ name: "externalId", example: "tx-ext-001", description: "Identificador externo da transação" })
  @ApiResponse({ status: 200, description: "Dados da transação" })
  @ApiResponse({ status: 404, description: "Transação não encontrada" })
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
