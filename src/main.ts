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

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Distributed Wagering Processor")
    .setDescription(
      "API Financeira de Processamento de Apostas com Ledger Imutável, Idempotência Persistente e Auditoria Contábil",
    )
    .setVersion("0.3.0")
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
