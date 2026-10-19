import "reflect-metadata";
import {
  Controller,
  Get,
  Inject,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  Optional,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { MikroORM } from "@mikro-orm/postgresql";
import type { Request, Response } from "express";
import { register } from "prom-client";
import { loadConfig } from "./infrastructure/config/config";
import { appStructuredLogger } from "./infrastructure/observability/app-logger";
import {
  InboxMessageSchema,
  type InboxMessageRecord,
  OutboxMessageSchema,
  type OutboxMessageRecord,
  WagerTransactionSchema,
  type WagerTransactionRecord,
} from "./infrastructure/persistence/schemas";
import { HttpExceptionFilter } from "./interfaces/http/filters/http-exception.filter";
import { HttpModule, MIKRO_ORM } from "./interfaces/http/http.module";
import { CorrelationIdMiddleware } from "./interfaces/http/middlewares/correlation-id.middleware";
import { setupSwagger } from "./interfaces/http/swagger/swagger.config";
import { renderApiDocsView } from "./interfaces/http/views/api-docs.view";
import { renderMetricsDashboardView } from "./interfaces/http/views/metrics-dashboard.view";
import { renderPortalLandingView } from "./interfaces/http/views/portal-landing.view";
import { renderWalletSimulatorView } from "./interfaces/http/views/wallet-simulator.view";
import { WorkersModule } from "./interfaces/workers/workers.module";

@ApiTags("health")
@Controller("health")
export class HealthController {
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
export class MetricsController {
  constructor(
    @Optional() @Inject(MIKRO_ORM) private readonly orm?: MikroORM,
  ) {}

  @Get()
  @ApiOperation({ summary: "Portal de entrada com navegação para Documentação (Swagger) e Métricas" })
  @ApiResponse({ status: 200, description: "HTML do Portal de Navegação" })
  portal(@Res() res: Response): void {
    res.type("html").send(renderPortalLandingView());
  }

  @Get("docs")
  @ApiOperation({ summary: "Documentação visual Glassmorphic e console interativo da API" })
  @ApiResponse({ status: 200, description: "HTML da Documentação Interativa Glassmorphic" })
  docs(@Res() res: Response): void {
    res.type("html").send(renderApiDocsView());
  }

  @Get(["simulator", "playground"])
  @ApiOperation({ summary: "Simulador interativo visual de jogador, carteira e apostas" })
  @ApiResponse({ status: 200, description: "HTML do Simulador Visual de Jogador e Carteira" })
  simulator(@Res() res: Response): void {
    res.type("html").send(renderWalletSimulatorView());
  }

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
      res.type("html").send(renderMetricsDashboardView());
      return;
    }
    res.type(register.contentType).send(await register.metrics());
  }

  @Get("api/metrics")
  @ApiOperation({ summary: "Métricas em formato JSON para o dashboard em tempo real" })
  async metricsJson(): Promise<unknown> {
    return register.getMetricsAsJSON();
  }

  @Get("api/dashboard/operations")
  @ApiOperation({ summary: "Lista de operações detalhadas para inspeção interativa no Dashboard" })
  async operations(
    @Query("category") category?: string,
    @Query("type") type?: string,
    @Query("kind") kind?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ): Promise<{ items: unknown[]; totalCount: number }> {
    if (!this.orm) {
      return { items: [], totalCount: 0 };
    }
    const em = this.orm.em.fork();
    const maxLimit = Math.min(Number(limit) || 25, 50);

    try {
      if (category === "PUBLISHED") {
        const where: Record<string, unknown> = {};
        if (type && type !== "Desconhecido") {
          where.eventType = type;
        }
        const [records, totalCount] = await em.findAndCount(
          OutboxMessageSchema,
          where,
          { limit: maxLimit, orderBy: { occurredAt: "desc" } },
        );
        return {
          totalCount,
          items: records.map((r: OutboxMessageRecord) => {
            const payload = (r.payload || {}) as Record<string, unknown>;
            return {
              id: r.id,
              aggregateId: r.aggregateId,
              type: r.eventType,
              occurredAt: r.occurredAt ? new Date(r.occurredAt).toLocaleString("pt-BR") : "-",
              publishedAt: r.publishedAt ? new Date(r.publishedAt).toLocaleString("pt-BR") : "Pendente",
              status: r.publishedAt ? "PUBLISHED" : "PENDING",
              attempts: r.attempts ?? 0,
              payload: r.payload,
              summary: payload.balanceAfter
                ? `Saldo: R$ ${String(payload.balanceBefore || "0.00")} → R$ ${String(payload.balanceAfter)}`
                : (payload.kind ? `${String(payload.kind)} - ${String(payload.amount || "")}` : "Evento SQS"),
            };
          }),
        };
      }

      if (category === "CONSUMED") {
        const [records, totalCount] = await em.findAndCount(
          InboxMessageSchema,
          {},
          { limit: maxLimit, orderBy: { receivedAt: "desc" } },
        );
        return {
          totalCount,
          items: records.map((r: InboxMessageRecord) => ({
            id: r.messageId,
            consumerName: r.consumerName,
            receivedAt: r.receivedAt ? new Date(r.receivedAt).toLocaleString("pt-BR") : "-",
            processedAt: r.processedAt ? new Date(r.processedAt).toLocaleString("pt-BR") : "Processando",
            status: r.processedAt ? "PROCESSED" : "PENDING",
            summary: `Consumidor: ${r.consumerName}`,
          })),
        };
      }

      // Default or TRANSACTION or IDEMPOTENT_REPLAY or RESOLVED:
      const where: Record<string, unknown> = {};
      if (kind && kind !== "TX") {
        where.kind = kind.toUpperCase();
      }
      if (status && (status === "PROCESSED" || status === "REJECTED" || status === "PENDING_REFERENCE")) {
        where.status = status;
      }
      if (category === "RESOLVED") {
        where.referenceExternalTransactionId = { $ne: null };
      }

      const [records, totalCount] = await em.findAndCount(
        WagerTransactionSchema,
        where,
        { limit: maxLimit, orderBy: { createdAt: "desc" } },
      );

      return {
        totalCount,
        items: records.map((r: WagerTransactionRecord) => ({
          id: r.id,
          providerId: r.providerId,
          externalTransactionId: r.externalTransactionId,
          walletId: r.walletId,
          playerId: r.playerId,
          kind: r.kind,
          amount: `${r.currency || "BRL"} ${r.amount}`,
          status: r.status,
          failureCode: r.failureCode,
          idempotencyKey: r.idempotencyKey,
          createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString("pt-BR") : "-",
          referenceExternalTransactionId: r.referenceExternalTransactionId,
          summary: `${r.kind} de ${r.currency || "BRL"} ${r.amount} (${r.status})`,
        })),
      };
    } catch {
      return { items: [], totalCount: 0 };
    }
  }

  @Get("dashboard")
  @ApiOperation({ summary: "Painel visual Glassmorphic do Outbox Observer" })
  dashboard(@Res() res: Response): void {
    res.type("html").send(renderMetricsDashboardView());
  }
}

@Module({
  imports: [HttpModule, WorkersModule.register()],
  controllers: [HealthController, MetricsController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}

export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    logger: appStructuredLogger,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  setupSwagger(app);

  return app;
}

async function bootstrap() {
  const config = loadConfig();
  const app = await createApp();
  await app.listen(config.PORT);
  appStructuredLogger.log({
    msg: "Application started successfully",
    role: config.APP_ROLE,
    instanceId: config.INSTANCE_ID,
    port: config.PORT,
    swaggerDocs: `http://localhost:${config.PORT}/api/docs`,
  });
}

if (import.meta.main) {
  bootstrap();
}
