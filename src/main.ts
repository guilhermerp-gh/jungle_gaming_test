import "reflect-metadata";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { loadConfig } from "./infrastructure/config/config";
import { HttpExceptionFilter } from "./interfaces/http/filters/http-exception.filter";
import { HttpModule } from "./interfaces/http/http.module";

@Controller("health")
class HealthController {
  @Get("live")
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
    }),
  );
}

if (import.meta.main) {
  bootstrap();
}
