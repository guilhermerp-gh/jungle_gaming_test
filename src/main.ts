import "reflect-metadata";
import { Controller, Get, Module, Query, Req, Res } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { register } from "prom-client";
import { loadConfig } from "./infrastructure/config/config";
import { HttpExceptionFilter } from "./interfaces/http/filters/http-exception.filter";
import { HttpModule } from "./interfaces/http/http.module";
import { renderMetricsDashboardHtml } from "./interfaces/http/views/metrics-dashboard.html";
import { WorkersModule } from "./interfaces/workers/workers.module";

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

@ApiTags("observability")
@Controller()
class MetricsController {
  @Get("metrics")
  @ApiOperation({ summary: "Métricas Prometheus e Dashboard visual interativo" })
  @ApiResponse({ status: 200, description: "HTML no navegador ou formato Prometheus para coletores" })
  async metrics(
    @Req() req: Request,
    @Res() res: Response,
    @Query("raw") raw?: string,
  ): Promise<void> {
    const isBrowser = req.headers.accept?.includes("text/html");
    if (isBrowser && raw !== "true") {
      res.type("html").send(renderMetricsDashboardHtml());
      return;
    }
    res.type(register.contentType).send(await register.metrics());
  }

  @Get("api/metrics")
  @ApiOperation({ summary: "Métricas em formato JSON para o dashboard em tempo real" })
  async metricsJson(): Promise<unknown> {
    return register.getMetricsAsJSON();
  }

  @Get("dashboard")
  @ApiOperation({ summary: "Painel visual Glassmorphic do Outbox Observer" })
  dashboard(@Res() res: Response): void {
    res.type("html").send(renderMetricsDashboardHtml());
  }
}

@Module({
  imports: [HttpModule, WorkersModule.register()],
  controllers: [HealthController, MetricsController],
})
export class AppModule {}

export async function createApp() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  const swaggerDescription = `
### 🎰 API Financeira de Processamento de Apostas

Serviço distribuído com **Ledger Imutável**, **Idempotência Persistente**, **Locks Pessimistas por Carteira**, **Auditoria Contábil em Tempo Real** e **Transactional Outbox Publisher (AWS SQS FIFO)**.

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
   - **Retorno esperado:** \`201 Created\` com saldo restante de \`"70.00"\`. *(O Transactional Outbox gera automaticamente os eventos de integração e os despacha para a fila AWS SQS FIFO \`wallet-events.fifo\`)*.
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
8. **8️⃣ Monitoramento da Outbox & Mensageria (\`GET /metrics\` ou \`GET /dashboard\`):**
   - Acesse o endpoint de métricas Prometheus ou o [Dashboard Visual](http://localhost:3000/dashboard) para acompanhar os eventos publicados no SQS FIFO (\`events_published_total\`) e o lag da outbox (\`outbox_lag_seconds\`).
`;

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Distributed Wagering Processor")
    .setDescription(swaggerDescription)
    .setVersion("0.5.0")
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
    .addTag("observability", "Métricas Prometheus e monitoramento da Outbox")
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
