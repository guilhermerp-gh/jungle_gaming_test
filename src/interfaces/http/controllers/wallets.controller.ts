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
  async create(
    @Body(new ZodValidationPipe(CreateWalletSchema)) dto: CreateWalletDto,
  ): Promise<WalletResponseDto> {
    return this.createWalletUseCase.execute(dto);
  }

  @Get(":id")
  async getById(@Param("id") id: string): Promise<WalletResponseDto> {
    this.assertValidUuid(id, "walletId");
    return this.getWalletUseCase.execute(id);
  }

  @Get(":id/ledger")
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
