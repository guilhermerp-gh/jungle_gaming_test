import "reflect-metadata";
import { Controller, Get, Module, Query, Req, Res } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { register } from "prom-client";
import { loadConfig } from "./infrastructure/config/config";
import { HttpExceptionFilter } from "./interfaces/http/filters/http-exception.filter";
import { HttpModule } from "./interfaces/http/http.module";
import { setupSwagger } from "./interfaces/http/swagger/swagger.config";
import { renderApiDocsView } from "./interfaces/http/views/api-docs.view";
import { renderMetricsDashboardView } from "./interfaces/http/views/metrics-dashboard.view";
import { renderPortalLandingView } from "./interfaces/http/views/portal-landing.view";
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
export class AppModule {}

export async function createApp() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  setupSwagger(app);

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
