import "reflect-metadata";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { loadConfig } from "./infrastructure/config/config";
import { HttpExceptionFilter } from "./interfaces/http/filters/http-exception.filter";
import { HttpModule } from "./interfaces/http/http.module";

@ApiTags("health")
@Controller("health")
class HealthController {
  @Get("live")
  @ApiOperation({ summary: "Verificação de disponibilidade do serviço (liveness probe)" })
  @ApiResponse({ status: 200, description: "Serviço operacional" })
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  @ApiOperation({ summary: "Verificação de prontidão para receber tráfego (readiness probe)" })
  @ApiResponse({ status: 200, description: "Serviço pronto para receber tráfego" })
  ready() {
    return { status: "ok" };
  }
}

@Module({
  imports: [HttpModule],
  controllers: [HealthController],
})
export class AppModule {}

export async function createApp() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  const swaggerDescription = `
### 🎰 API Financeira de Processamento de Apostas

Serviço distribuído com **Ledger Imutável**, **Idempotência Persistente**, **Locks Pessimistas por Carteira** e **Auditoria Contábil em Tempo Real**.

---

### 🚀 Guia Rápido de Teste (Ordem Recomendada de Execução):

Siga o passo a passo abaixo para testar o fluxo financeiro completo de ponta a ponta:

1. **1️⃣ Criar uma Carteira (\`POST /wallets\`):**
   - Informe um \`playerId\` (UUID) e um saldo inicial (ex: \`"100.00"\`).
   - Copie o **\`id\` da carteira** gerado no retorno.
2. **2️⃣ Consultar Saldo da Carteira (\`GET /wallets/{id}\`):**
   - Cole o \`id\` da carteira para visualizar o saldo atualizado e a versão.
3. **3️⃣ Realizar uma Aposta (\`POST /transactions\`):**
   - No cabeçalho \`Idempotency-Key\`, informe uma chave única (ex: \`req-001\`).
   - No corpo, use \`kind: "BET"\`, \`amount: "30.00"\` e cole o seu \`walletId\`.
   - **Retorno esperado:** \`201 Created\` com saldo restante de \`"70.00"\`.
4. **4️⃣ Testar a Idempotência (\`POST /transactions\`):**
   - Clique em **Execute** novamente sem alterar nada (mesma chave e mesmo corpo).
   - **Retorno esperado:** \`200 OK\` com \`"idempotentReplay": true\` — seu saldo NÃO será debitado novamente!
5. **5️⃣ Creditar um Prêmio (\`POST /transactions\`):**
   - Altere a \`Idempotency-Key\` para \`req-002\`, \`externalTransactionId\` para outro id e mude \`kind\` para \`"WIN"\` com valor \`"50.00"\`.
   - **Retorno esperado:** \`201 Created\` com saldo elevado para \`"120.00"\`.
6. **6️⃣ Consultar Extrato do Ledger (\`GET /wallets/{id}/ledger\`):**
   - Visualize o histórico imutável de lançamentos contábeis (OPENING, DEBIT e CREDIT).
7. **7️⃣ Auditoria e Reconciliação Contábil (\`POST /wallets/{id}/reconciliation\`):**
   - Dispare a reconciliação matemática da carteira para comprovar que \`consistent: true\` e \`difference: "0.00"\`.
`;

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Distributed Wagering Processor")
    .setDescription(swaggerDescription)
    .setVersion("0.4.0")
    .addApiKey(
      {
        type: "apiKey",
        name: "Idempotency-Key",
        in: "header",
        description: "Chave única de idempotência para garantir execução única",
      },
      "Idempotency-Key",
    )
    .addTag("wallets", "Gerenciamento de carteiras, saldos, extrato ledger e reconciliação")
    .addTag("transactions", "Processamento de apostas (BET, WIN, LOSS, REFUND, ROLLBACK)")
    .addTag("health", "Saúde e monitoramento do serviço")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document, {
    customSiteTitle: "Jungle Gaming - Wagering Processor API Docs",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  return app;
}

async function bootstrap() {
  const config = loadConfig();
  const app = await createApp();
  await app.listen(config.PORT);
  console.log(
    JSON.stringify({
      level: "info",
      msg: "started",
      role: config.APP_ROLE,
      port: config.PORT,
      swaggerDocs: `http://localhost:${config.PORT}/api/docs`,
    }),
  );
}

if (import.meta.main) {
  bootstrap();
}
