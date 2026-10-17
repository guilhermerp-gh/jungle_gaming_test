import "reflect-metadata";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { loadConfig } from "./infrastructure/config/config";

@Controller("health")
class HealthController {
  @Get("live")
  live() {
    return { status: "ok" };
  }
}

@Module({ controllers: [HealthController] })
class AppModule {}

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(config.PORT);
  console.log(JSON.stringify({ level: "info", msg: "started", role: config.APP_ROLE, port: config.PORT }));
}

bootstrap();
