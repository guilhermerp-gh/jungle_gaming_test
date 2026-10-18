import { randomUUID } from "node:crypto";
import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  type Message,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import {
  Injectable,
  Logger,
  Optional,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { z } from "zod";
import { FailureCode } from "../../domain/errors/failure-code";
import { DomainError } from "../../domain/errors/domain-error";
import { ProcessWagerTransactionUseCase } from "../../application/use-cases/process-wager-transaction.use-case";
import { loadConfig } from "../../infrastructure/config/config";
import { waitForFailureInjection } from "../../infrastructure/testing/failure-injection";
import {
  defaultSqsConsumerMetrics,
  SqsConsumerMetrics,
} from "../../infrastructure/observability/sqs-consumer-metrics";

export const WagerMessagePayloadSchema = z.object({
  idempotencyKey: z.string().min(1),
  providerId: z.string().min(1),
  externalTransactionId: z.string().min(1),
  playerId: z.string().uuid(),
  walletId: z.string().uuid(),
  roundId: z.string().min(1),
  gameId: z.string().min(1),
  kind: z.enum(["BET", "WIN", "LOSS", "REFUND", "ROLLBACK"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().length(3),
  referenceExternalTransactionId: z.string().nullish(),
});

export type WagerMessagePayload = z.infer<typeof WagerMessagePayloadSchema>;

const PERSISTED_REJECTIONS: FailureCode[] = [
  FailureCode.INSUFFICIENT_FUNDS,
  FailureCode.REVERSAL_INSUFFICIENT_FUNDS,
  FailureCode.REFERENCE_MISMATCH,
  FailureCode.AMOUNT_MISMATCH,
  FailureCode.ALREADY_REVERSED,
  FailureCode.INVALID_REFERENCE_KIND,
  FailureCode.REFERENCE_NOT_PROCESSED,
];

const UNRECOVERABLE_FAILURES: FailureCode[] = [
  FailureCode.INVALID_PAYLOAD,
  FailureCode.WALLET_NOT_FOUND,
  FailureCode.WALLET_PLAYER_MISMATCH,
  FailureCode.CURRENCY_MISMATCH,
  FailureCode.IDEMPOTENCY_CONFLICT,
];

export interface WagerTransactionsConsumerWorkerOptions {
  queueUrl?: string;
  dlqUrl?: string;
  endpoint?: string;
  region?: string;
  waitTimeSeconds?: number;
  maxNumberOfMessages?: number;
  visibilityTimeout?: number;
  pollIntervalMs?: number;
  sqsClient?: SQSClient;
  metrics?: SqsConsumerMetrics;
}

@Injectable()
export class WagerTransactionsConsumerWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WagerTransactionsConsumerWorker.name);
  private isRunning = false;
  private loopPromise?: Promise<void>;
  private abortController = new AbortController();
  private readonly activeMessages = new Map<string, Message>();

  private readonly client: SQSClient;
  private readonly queueUrl: string;
  private readonly dlqUrl: string;
  private readonly waitTimeSeconds: number;
  private readonly maxNumberOfMessages: number;
  private readonly visibilityTimeout: number;
  private readonly pollIntervalMs: number;
  private readonly metrics: SqsConsumerMetrics;

  constructor(
    private readonly useCase: ProcessWagerTransactionUseCase,
    @Optional() options?: WagerTransactionsConsumerWorkerOptions,
  ) {
    const config = loadConfig();
    this.queueUrl = options?.queueUrl ?? config.WAGER_QUEUE_URL;
    this.dlqUrl =
      options?.dlqUrl ??
      config.DLQ_QUEUE_URL ??
      this.queueUrl.replace("wager-transactions.fifo", "wager-transactions-dlq.fifo");

    this.waitTimeSeconds =
      options?.waitTimeSeconds ??
      (process.env.SQS_CONSUMER_WAIT_TIME_SECONDS ? Number(process.env.SQS_CONSUMER_WAIT_TIME_SECONDS) : 20);
    this.maxNumberOfMessages = options?.maxNumberOfMessages ?? 10;
    this.visibilityTimeout =
      options?.visibilityTimeout ??
      (process.env.SQS_CONSUMER_VISIBILITY_TIMEOUT ? Number(process.env.SQS_CONSUMER_VISIBILITY_TIMEOUT) : 30);
    this.pollIntervalMs = options?.pollIntervalMs ?? 100;
    this.metrics = options?.metrics ?? defaultSqsConsumerMetrics;

    this.client =
      options?.sqsClient ??
      new SQSClient({
        region: options?.region ?? config.AWS_REGION,
        endpoint: options?.endpoint ?? config.AWS_ENDPOINT_URL,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
        },
      });
  }

  async onApplicationBootstrap(): Promise<void> {
    const config = loadConfig();
    if (config.APP_ROLE !== "all" && config.APP_ROLE !== "consumer") {
      this.logger.log(
        `WagerTransactionsConsumerWorker desabilitado para APP_ROLE=${config.APP_ROLE}`,
      );
      return;
    }

    this.start();
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.abortController = new AbortController();
    this.logger.log("WagerTransactionsConsumerWorker iniciado");
    this.loopPromise = this.loop();
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(
      `Encerrando WagerTransactionsConsumerWorker (sinal: ${signal ?? "shutdown"})...`,
    );
    this.isRunning = false;
    this.abortController.abort();

    // Aguarda conclusão das mensagens em andamento (timeout de até 20s)
    const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 20_000));
    await Promise.race([this.loopPromise, timeoutPromise]);

    // Devolve visibilidade das mensagens não concluídas imediatamente
    for (const pending of this.activeMessages.values()) {
      if (pending.ReceiptHandle) {
        try {
          await this.client.send(
            new ChangeMessageVisibilityCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: pending.ReceiptHandle,
              VisibilityTimeout: 0,
            }),
          );
        } catch {
          // ignora erro no shutdown
        }
      }
    }
    this.logger.log("WagerTransactionsConsumerWorker finalizado com sucesso");
  }

  async pollOnce(): Promise<number> {
    try {
      const response = await this.client.send(
        new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: this.maxNumberOfMessages,
          WaitTimeSeconds: this.waitTimeSeconds,
          VisibilityTimeout: this.visibilityTimeout,
          MessageSystemAttributeNames: ["ApproximateReceiveCount", "MessageGroupId"],
          MessageAttributeNames: ["All"],
        }),
        { abortSignal: this.abortController.signal },
      );

      const messages = response.Messages ?? [];
      if (messages.length === 0) return 0;

      await Promise.all(messages.map((msg) => this.processSingleMessage(msg)));
      return messages.length;
    } catch (err: unknown) {
      if (!this.isRunning) return 0;
      throw err;
    }
  }

  async processSingleMessage(msg: Message): Promise<void> {
    const messageId = msg.MessageId ?? randomUUID();
    const activeKey = msg.ReceiptHandle ?? messageId;
    this.activeMessages.set(activeKey, msg);

    const startTime = performance.now();
    try {
      const rawBody = msg.Body ?? "";
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawBody);
      } catch {
        await this.handlePoisonPill(msg, "InvalidJson");
        return;
      }

      const validation = WagerMessagePayloadSchema.safeParse(parsedJson);
      if (!validation.success) {
        await this.handlePoisonPill(msg, "InvalidSchema");
        return;
      }

      const payload = validation.data;
      const result = await this.useCase.execute(
        payload.idempotencyKey,
        {
          providerId: payload.providerId,
          externalTransactionId: payload.externalTransactionId,
          playerId: payload.playerId,
          walletId: payload.walletId,
          roundId: payload.roundId,
          gameId: payload.gameId,
          kind: payload.kind,
          amount: payload.amount,
          currency: payload.currency,
          referenceExternalTransactionId: payload.referenceExternalTransactionId ?? null,
        },
        {
          consumerName: "wager-transactions-consumer",
          messageId,
        },
      );

      const durationSec = (performance.now() - startTime) / 1000;
      this.metrics.recordDuration("wager-transactions-consumer", durationSec);

      if (result.idempotentReplay) {
        this.metrics.recordConsumed("wager-transactions-consumer", "idempotent_replay");
      } else {
        this.metrics.recordConsumed("wager-transactions-consumer", "success");
      }
      await waitForFailureInjection("TEST_HOOK_AFTER_CONSUMER_COMMIT_MS");

      if (msg.ReceiptHandle) {
        await this.client.send(
          new DeleteMessageCommand({
            QueueUrl: this.queueUrl,
            ReceiptHandle: msg.ReceiptHandle,
          }),
        );
      }
    } catch (err: unknown) {
      const durationSec = (performance.now() - startTime) / 1000;
      this.metrics.recordDuration("wager-transactions-consumer", durationSec);

      if (err instanceof DomainError) {
        const isPersistedRejection = PERSISTED_REJECTIONS.includes(err.code);

        if (isPersistedRejection) {
          this.logger.log(
            `Transação rejeitada por regra de negócio persistida (${err.code}). Ack no SQS para ${messageId}`,
          );
          this.metrics.recordConsumed("wager-transactions-consumer", "business_rejection");

          if (msg.ReceiptHandle) {
            await this.client.send(
              new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: msg.ReceiptHandle,
              }),
            );
          }
          return;
        }

        const isUnrecoverable = UNRECOVERABLE_FAILURES.includes(err.code);

        if (isUnrecoverable) {
          await this.handlePoisonPill(msg, err.code);
          return;
        }
      }

      this.logger.error(`Erro transitório ao processar mensagem ${messageId}:`, err);
      this.metrics.recordConsumed("wager-transactions-consumer", "transient_error");

      const receiveCount = Number(msg.Attributes?.ApproximateReceiveCount ?? "1");
      const delaySeconds = Math.min(Math.pow(2, Math.max(1, receiveCount)), 60);

      if (msg.ReceiptHandle) {
        try {
          await this.client.send(
            new ChangeMessageVisibilityCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: msg.ReceiptHandle,
              VisibilityTimeout: delaySeconds,
            }),
          );
        } catch (visErr) {
          this.logger.warn(`Falha ao alterar visibilidade da mensagem ${messageId}:`, visErr);
        }
      }
    } finally {
      this.activeMessages.delete(activeKey);
    }
  }

  private async handlePoisonPill(msg: Message, reason: string): Promise<void> {
    const messageId = msg.MessageId ?? randomUUID();
    this.logger.warn(`Mensagem classificada como Poison Pill (${reason}): ${messageId}`);

    if (this.dlqUrl) {
      try {
        await this.client.send(
          new SendMessageCommand({
            QueueUrl: this.dlqUrl,
            MessageBody: msg.Body ?? "{}",
            MessageGroupId: msg.Attributes?.MessageGroupId ?? "poison-pill",
            MessageDeduplicationId: messageId,
            MessageAttributes: {
              ErrorReason: {
                DataType: "String",
                StringValue: reason,
              },
            },
          }),
        );
        this.metrics.recordDlq("wager-transactions-consumer", reason);
      } catch (err) {
        this.logger.error(`Erro ao despachar poison pill para a DLQ: ${messageId}`, err);
      }
    }

    if (msg.ReceiptHandle) {
      try {
        await this.client.send(
          new DeleteMessageCommand({
            QueueUrl: this.queueUrl,
            ReceiptHandle: msg.ReceiptHandle,
          }),
        );
      } catch (err) {
        this.logger.error(`Erro ao deletar poison pill da fila principal: ${messageId}`, err);
      }
    }

    this.metrics.recordConsumed("wager-transactions-consumer", "poison_pill");
  }

  private async loop(): Promise<void> {
    while (this.isRunning) {
      try {
        const count = await this.pollOnce();
        if (count > 0 && this.isRunning) {
          await this.sleep(20);
          continue;
        }
      } catch (err: unknown) {
        if (!this.isRunning) break;
        this.logger.error("Erro no ciclo de polling do WagerTransactionsConsumerWorker", err);
      }

      if (this.isRunning) {
        await this.sleep(this.pollIntervalMs);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
