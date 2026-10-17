import { type PipeTransform, Injectable } from "@nestjs/common";
import { type ZodType } from "zod";
import { DomainError } from "../../../domain/errors/domain-error";
import { FailureCode } from "../../../domain/errors/failure-code";

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const messages = result.error.issues.map(
        (issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`,
      );
      throw new DomainError(
        FailureCode.INVALID_PAYLOAD,
        `Validation failed: ${messages.join("; ")}`,
      );
    }
    return result.data;
  }
}
