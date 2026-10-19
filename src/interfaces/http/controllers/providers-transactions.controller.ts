import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { TransactionResponseDto } from "../../../application/dto";
import { GetTransactionUseCase } from "../../../application/use-cases";
import { DomainError } from "../../../domain/errors/domain-error";
import { FailureCode } from "../../../domain/errors/failure-code";
import { AuthGuard } from "../guards/auth.guard";

@ApiTags("providers")
@Controller("providers")
@UseGuards(AuthGuard)
export class ProvidersTransactionsController {
  constructor(private readonly getTransactionUseCase: GetTransactionUseCase) {}

  @Get(":providerId/wagering/transactions/:externalTransactionId")
  @ApiOperation({
    summary: "Consultar transação por provedor e ID externo (rota canônica Jungle Gaming)",
    description:
      "Permite que provedores consultem o status de suas transações no padrão canônico da Jungle Gaming.",
  })
  @ApiParam({ name: "providerId", example: "evolution", description: "Identificador do provedor" })
  @ApiParam({
    name: "externalTransactionId",
    example: "tx-ext-001",
    description: "Identificador externo da transação",
  })
  @ApiResponse({ status: 200, description: "Dados da transação" })
  @ApiResponse({ status: 404, description: "Transação não encontrada" })
  async getByExternal(
    @Param("providerId") providerId: string,
    @Param("externalTransactionId") externalTransactionId: string,
  ): Promise<TransactionResponseDto> {
    if (!providerId || !externalTransactionId) {
      throw new DomainError(
        FailureCode.INVALID_PAYLOAD,
        "providerId and externalTransactionId are required",
      );
    }
    return this.getTransactionUseCase.execute({
      providerId,
      externalTransactionId,
    });
  }
}
