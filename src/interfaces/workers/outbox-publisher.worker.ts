import { Injectable, Logger, Optional, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { PublishOutboxMessagesUseCase } from "../../application/use-cases/publish-outbox-messages.use-case";
import { loadConfig } from "../../infrastructure/config/config";

export interface OutboxPublisherWorkerOptions {
  pollIntervalMs?: number;
  batchSize?: number;
  leaseMs?: number;
}

@Injectable()
export class OutboxPublisherWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxPublisherWorker.name);
  private isRunning = false;
  private loopPromise?: Promise<void>;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly leaseMs: number;

  constructor(
    private readonly publishUseCase: PublishOutboxMessagesUseCase,
    @Optional() options?: OutboxPublisherWorkerOptions,
  ) {
    this.pollIntervalMs = options?.pollIntervalMs ?? 200;
    this.batchSize = options?.batchSize ?? 50;
    this.leaseMs = options?.leaseMs ?? 30_000;
  }

  async onApplicationBootstrap(): Promise<void> {
    const config = loadConfig();
    if (config.APP_ROLE !== "all" && config.APP_ROLE !== "outbox") {
      this.logger.log(`OutboxPublisherWorker desabilitado para APP_ROLE=${config.APP_ROLE}`);
      return;
    }

    this.start();
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.log("OutboxPublisherWorker iniciado");
    this.loopPromise = this.loop();
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Encerrando OutboxPublisherWorker (sinal: ${signal ?? "shutdown"})...`);
    this.isRunning = false;

    // Aguarda o loop corrente finalizar (com timeout de segurança de 20s)
    const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 20_000));
    await Promise.race([this.loopPromise, timeoutPromise]);
    this.logger.log("OutboxPublisherWorker finalizado com sucesso");
  }

  private async loop(): Promise<void> {
    while (this.isRunning) {
      try {
        const result = await this.publishUseCase.execute({
          batchSize: this.batchSize,
          leaseMs: this.leaseMs,
        });

        // Se houve mensagens no lote, segue drenando rapidamente a fila
        if (result.claimedCount > 0 && this.isRunning) {
          await this.sleep(20);
          continue;
        }
      } catch (err) {
        this.logger.error("Erro no ciclo do OutboxPublisherWorker", err);
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
