import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { APP_VERSION, loadConfig } from "../../src/infrastructure/config/config";

describe("Application Configuration & Version", () => {
  it("carrega as variáveis de ambiente com validação Zod", () => {
    const config = loadConfig({
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
      WAGER_QUEUE_URL: "https://sqs.us-east-1.amazonaws.com/123/wager",
      EVENTS_QUEUE_URL: "https://sqs.us-east-1.amazonaws.com/123/events",
    });

    expect(config.APP_ROLE).toBe("all");
    expect(config.PORT).toBe(3000);
    expect(config.AWS_REGION).toBe("us-east-1");
  });

  it("carrega a versão do app dinamicamente a partir do package.json", () => {
    const pkgPath = resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };

    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
