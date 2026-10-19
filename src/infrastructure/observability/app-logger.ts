import type { LoggerService } from "@nestjs/common";
import pino, { type Logger as PinoInstance } from "pino";
import { CorrelationContext } from "./correlation-context";

export function createPinoLogger(): PinoInstance {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      instanceId: process.env.INSTANCE_ID ?? "local",
    },
  });
}

export const basePino = createPinoLogger();

export class AppStructuredLogger implements LoggerService {
  private readonly pino: PinoInstance;

  constructor(pinoInstance: PinoInstance = basePino) {
    this.pino = pinoInstance;
  }

  private enrich(contextOrObj?: unknown): Record<string, unknown> {
    const correlation = CorrelationContext.get() ?? {};
    if (typeof contextOrObj === "object" && contextOrObj !== null) {
      return {
        ...correlation,
        ...(contextOrObj as Record<string, unknown>),
      };
    }
    if (typeof contextOrObj === "string" && contextOrObj.length > 0) {
      return {
        ...correlation,
        context: contextOrObj,
      };
    }
    return { ...correlation };
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    const meta = optionalParams.length > 0 ? optionalParams[0] : undefined;
    const enriched = this.enrich(meta);
    if (typeof message === "string") {
      this.pino.info(enriched, message);
    } else if (typeof message === "object" && message !== null) {
      this.pino.info({ ...enriched, ...(message as Record<string, unknown>) });
    } else {
      this.pino.info(enriched, String(message));
    }
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const meta = optionalParams.length > 0 ? optionalParams[0] : undefined;
    const enriched = this.enrich(meta);
    if (typeof message === "string") {
      this.pino.error(enriched, message);
    } else if (typeof message === "object" && message !== null) {
      this.pino.error({ ...enriched, ...(message as Record<string, unknown>) });
    } else {
      this.pino.error(enriched, String(message));
    }
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    const meta = optionalParams.length > 0 ? optionalParams[0] : undefined;
    const enriched = this.enrich(meta);
    if (typeof message === "string") {
      this.pino.warn(enriched, message);
    } else if (typeof message === "object" && message !== null) {
      this.pino.warn({ ...enriched, ...(message as Record<string, unknown>) });
    } else {
      this.pino.warn(enriched, String(message));
    }
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    const meta = optionalParams.length > 0 ? optionalParams[0] : undefined;
    const enriched = this.enrich(meta);
    if (typeof message === "string") {
      this.pino.debug(enriched, message);
    } else if (typeof message === "object" && message !== null) {
      this.pino.debug({ ...enriched, ...(message as Record<string, unknown>) });
    } else {
      this.pino.debug(enriched, String(message));
    }
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.debug(message, ...optionalParams);
  }
}

export const appStructuredLogger = new AppStructuredLogger();
