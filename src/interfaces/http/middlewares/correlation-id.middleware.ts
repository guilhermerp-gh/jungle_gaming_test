import { Injectable, type NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { CorrelationContext } from "../../../infrastructure/observability/correlation-context";

export const CORRELATION_ID_HEADER = "X-Correlation-Id";

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incomingHeader = req.headers[CORRELATION_ID_HEADER.toLowerCase()] ?? req.headers[CORRELATION_ID_HEADER];
    const correlationId =
      typeof incomingHeader === "string" && incomingHeader.trim().length > 0
        ? incomingHeader.trim()
        : randomUUID();

    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    (req as Request & { correlationId?: string }).correlationId = correlationId;

    CorrelationContext.run(
      {
        correlationId,
        instanceId: process.env.INSTANCE_ID ?? "local",
      },
      () => next(),
    );
  }
}
