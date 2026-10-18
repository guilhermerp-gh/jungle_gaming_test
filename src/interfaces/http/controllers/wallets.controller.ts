import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  CreateWalletSchema,
  DepositSchema,
  GetLedgerQuerySchema,
  type CreateWalletDto,
  type DepositDto,
  type DepositResponseDto,
  type GetLedgerQueryDto,
  type LedgerPageDto,
  type ReconciliationResponseDto,
  type WalletResponseDto,
} from "../../../application/dto";
import {
  CreateWalletUseCase,
  DepositUseCase,
  GetLedgerUseCase,
  GetWalletUseCase,
  ReconcileWalletUseCase,
} from "../../../application/use-cases";
import { DomainError } from "../../../domain/errors/domain-error";
import { FailureCode } from "../../../domain/errors/failure-code";
import { AuthGuard } from "../guards/auth.guard";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@ApiTags("wallets")
@Controller("wallets")
@UseGuards(AuthGuard)
export class WalletsController {
  constructor(
    private readonly createWalletUseCase: CreateWalletUseCase,
    private readonly depositUseCase: DepositUseCase,
    private readonly getWalletUseCase: GetWalletUseCase,
    private readonly getLedgerUseCase: GetLedgerUseCase,
    private readonly reconcileWalletUseCase: ReconcileWalletUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Criar carteira",
    description: "Cria uma carteira para um jogador na moeda especificada (relação 1 jogador = 1 carteira por moeda: BRL, USD, EUR, etc.). Caso o playerId já possua carteira na mesma moeda, retorna 409 Conflict. Para criar carteiras para múltiplos jogadores, informe um UUID diferente em playerId.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["playerId", "currency"],
      properties: {
        playerId: { type: "string", format: "uuid", example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", description: "UUID do jogador (cada jogador pode ter 1 carteira por moeda)" },
        currency: { type: "string", example: "BRL", description: "Código ISO-4217 de 3 letras maiúsculas (ex: BRL, USD, EUR)" },
        initialBalance: { type: "string", example: "100.00", description: "Saldo de abertura opcional (formato decimal com 2 casas)" },
      },
    },
  })
  @ApiResponse({ status: 201, description: "Carteira criada com sucesso" })
  @ApiResponse({ status: 400, description: "Payload inválido" })
  @ApiResponse({ status: 409, description: "Carteira já existe para este jogador e moeda" })
  async create(
    @Body(new ZodValidationPipe(CreateWalletSchema)) dto: CreateWalletDto,
  ): Promise<WalletResponseDto> {
    return this.createWalletUseCase.execute(dto);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Consultar carteira",
    description: "Retorna dados cadastrais, saldo atual e versão de concorrência da carteira.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "UUID da carteira", example: "4a89972f-1ac6-4cf8-949f-c8c9605baf27" })
  @ApiResponse({ status: 200, description: "Dados da carteira" })
  @ApiResponse({ status: 400, description: "ID inválido" })
  @ApiResponse({ status: 404, description: "Carteira não encontrada" })
  async getById(@Param("id") id: string): Promise<WalletResponseDto> {
    this.assertValidUuid(id, "walletId");
    return this.getWalletUseCase.execute(id);
  }

  @Post(":id/deposit")
  @ApiOperation({
    summary: "Efetuar depósito na carteira",
    description: "Credita um valor na carteira com lock pessimista, garantia de idempotência, lançamento imutável no ledger contábil e emissão de evento na Outbox.",
  })
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Identificador único da requisição para prevenção de duplicidade",
    example: "req-dep-001",
  })
  @ApiParam({ name: "id", format: "uuid", description: "UUID da carteira", example: "4a89972f-1ac6-4cf8-949f-c8c9605baf27" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["amount"],
      properties: {
        amount: { type: "string", example: "50.00", description: "Valor do depósito com 2 casas decimais" },
        providerId: { type: "string", example: "CASHIER", description: "Provedor ou canal de pagamento (default: CASHIER)" },
        externalTransactionId: { type: "string", example: "dep-001", description: "ID externo do depósito no gateway (opcional)" },
      },
    },
  })
  @ApiResponse({ status: 201, description: "Depósito efetuado com sucesso" })
  @ApiResponse({ status: 200, description: "Replay idempotente do depósito" })
  @ApiResponse({ status: 400, description: "Payload ou Idempotency-Key inválido" })
  @ApiResponse({ status: 404, description: "Carteira não encontrada" })
  @ApiResponse({ status: 409, description: "Conflito de idempotência" })
  async deposit(
    @Param("id") id: string,
    @Headers("Idempotency-Key") idempotencyKeyHeader: string | undefined,
    @Body(new ZodValidationPipe(DepositSchema)) dto: DepositDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DepositResponseDto> {
    this.assertValidUuid(id, "walletId");
    if (!idempotencyKeyHeader || idempotencyKeyHeader.trim().length === 0) {
      throw new DomainError(FailureCode.INVALID_PAYLOAD, "Missing Idempotency-Key header");
    }

    const result = await this.depositUseCase.execute(id, idempotencyKeyHeader.trim(), dto);
    if (result.idempotentReplay) {
      res.status(HttpStatus.OK);
    } else {
      res.status(HttpStatus.CREATED);
    }
    return result;
  }

  @Get(":id/ledger")
  @ApiOperation({
    summary: "Extrato contábil do livro-razão (ledger)",
    description: "Consulta extrato paginado de lançamentos imutáveis com paginação sequencial por cursor base64.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "UUID da carteira" })
  @ApiQuery({ name: "limit", required: false, description: "Limite de itens por página (default 20, máx 100)", example: 20 })
  @ApiQuery({ name: "cursor", required: false, description: "Cursor de paginação retornado na página anterior" })
  @ApiResponse({ status: 200, description: "Página de lançamentos do ledger" })
  @ApiResponse({ status: 404, description: "Carteira não encontrada" })
  async getLedger(
    @Param("id") id: string,
    @Query(new ZodValidationPipe(GetLedgerQuerySchema)) query: GetLedgerQueryDto,
  ): Promise<LedgerPageDto> {
    this.assertValidUuid(id, "walletId");
    return this.getLedgerUseCase.execute({
      walletId: id,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Post(":id/reconciliation")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Auditoria contábil da carteira",
    description: "Executa reconciliação matemática verificando se o saldo armazenado na carteira confere com o somatório de todos os créditos e débitos do ledger.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "UUID da carteira" })
  @ApiResponse({ status: 200, description: "Relatório de consistência contábil" })
  @ApiResponse({ status: 404, description: "Carteira não encontrada" })
  async reconcile(@Param("id") id: string): Promise<ReconciliationResponseDto> {
    this.assertValidUuid(id, "walletId");
    return this.reconcileWalletUseCase.execute(id);
  }

  private assertValidUuid(id: string, fieldName: string): void {
    if (!UUID_RE.test(id)) {
      throw new DomainError(
        FailureCode.INVALID_PAYLOAD,
        `Invalid ${fieldName}: must be a valid UUID`,
      );
    }
  }
}
