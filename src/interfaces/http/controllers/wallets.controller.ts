import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  CreateWalletSchema,
  GetLedgerQuerySchema,
  type CreateWalletDto,
  type GetLedgerQueryDto,
  type LedgerPageDto,
  type ReconciliationResponseDto,
  type WalletResponseDto,
} from "../../../application/dto";
import {
  CreateWalletUseCase,
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
    private readonly getWalletUseCase: GetWalletUseCase,
    private readonly getLedgerUseCase: GetLedgerUseCase,
    private readonly reconcileWalletUseCase: ReconcileWalletUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Criar carteira",
    description: "Cria uma carteira para um jogador com moeda especificada e opcionalmente credita saldo inicial gerando lançamento contábil OPENING.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["playerId", "currency"],
      properties: {
        playerId: { type: "string", format: "uuid", example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
        currency: { type: "string", example: "BRL" },
        initialBalance: { type: "string", example: "100.00" },
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
