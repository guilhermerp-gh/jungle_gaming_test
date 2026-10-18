import {
  type ArgumentsHost,
  type ExceptionFilter,
  Catch,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import { ConcurrencyConflictError } from "../../../application/ports/unit-of-work.port";
import { DomainError } from "../../../domain/errors/domain-error";
import { FailureCode } from "../../../domain/errors/failure-code";

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_SERVER_ERROR";
    let message = "An internal server error occurred";
    let retryable = false;

    if (exception instanceof DomainError) {
      code = exception.code;
      message = exception.message;
      retryable = false;

      switch (exception.code) {
        case FailureCode.INVALID_PAYLOAD:
          status = HttpStatus.BAD_REQUEST;
          break;
        case FailureCode.WALLET_NOT_FOUND:
        case FailureCode.TRANSACTION_NOT_FOUND:
          status = HttpStatus.NOT_FOUND;
          break;
        case FailureCode.WALLET_ALREADY_EXISTS:
        case FailureCode.IDEMPOTENCY_CONFLICT:
          status = HttpStatus.CONFLICT;
          break;
        case FailureCode.INSUFFICIENT_FUNDS:
        case FailureCode.REVERSAL_INSUFFICIENT_FUNDS:
        case FailureCode.REFERENCE_REQUIRED:
        case FailureCode.REFERENCE_NOT_FOUND:
        case FailureCode.REFERENCE_MISMATCH:
        case FailureCode.INVALID_REFERENCE_KIND:
        case FailureCode.REFERENCE_NOT_PROCESSED:
        case FailureCode.ALREADY_REVERSED:
        case FailureCode.AMOUNT_MISMATCH:
        case FailureCode.WALLET_PLAYER_MISMATCH:
        case FailureCode.CURRENCY_MISMATCH:
        default:
          status = HttpStatus.UNPROCESSABLE_ENTITY;
          break;
      }
    } else if (exception instanceof ConcurrencyConflictError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      code = "CONCURRENCY_CONFLICT";
      message = exception.message;
      retryable = true;
      response.setHeader("Retry-After", "1");
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === "object" && resp !== null && "code" in resp) {
        code = String((resp as Record<string, unknown>).code);
        message = String((resp as Record<string, unknown>).message ?? exception.message);
      } else if (typeof resp === "object" && resp !== null && "message" in resp) {
        const msg = (resp as Record<string, unknown>).message;
        message = Array.isArray(msg) ? msg.join("; ") : String(msg);
        code = status === HttpStatus.BAD_REQUEST ? FailureCode.INVALID_PAYLOAD : "HTTP_ERROR";
      } else {
        message = typeof resp === "string" ? resp : exception.message;
        code = status === HttpStatus.BAD_REQUEST ? FailureCode.INVALID_PAYLOAD : "HTTP_ERROR";
      }
      retryable = status >= 500 && status < 600;
    } else if (exception instanceof Error) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "Unhandled exception caught by filter",
          error: exception.message,
          stack: exception.stack,
        }),
      );
    }

    const body: ErrorEnvelope = {
      error: {
        code,
        message,
        retryable,
        ...(exception instanceof DomainError && exception.details ? { details: exception.details } : {}),
      },
    };

    response.status(status).json(body);
  }
}
