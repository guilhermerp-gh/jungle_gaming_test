import {
  Injectable,
  Logger,
  Optional,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { ResolvePendingReferencesUseCase } from "../../application/use-cases/resolve-pending-references.use-case";
import { loadConfig } from "../../infrastructure/config/config";

export interface PendingReferenceResolverWorkerOptions {
  pollIntervalMs?: number;
  batchSize?: number;
}

@Injectable()
export class PendingReferenceResolverWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PendingReferenceResolverWorker.name);
  private isRunning = false;
  private loopPromise?: Promise<void>;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;

  constructor(
    private readonly resolveUseCase: ResolvePendingReferencesUseCase,
    @Optional() options?: PendingReferenceResolverWorkerOptions,
  ) {
    this.pollIntervalMs = options?.pollIntervalMs ?? 1000;
    this.batchSize = options?.batchSize ?? 50;
  }

  async onApplicationBootstrap(): Promise<void> {
    const config = loadConfig();
    if (config.APP_ROLE !== "all" && config.APP_ROLE !== "resolver") {
      this.logger.log(
        `PendingReferenceResolverWorker desabilitado para APP_ROLE=${config.APP_ROLE}`,
      );
      return;
    }

    this.start();
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.log("PendingReferenceResolverWorker iniciado");
    this.loopPromise = this.loop();
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(
      `Encerrando PendingReferenceResolverWorker (sinal: ${signal ?? "shutdown"})...`,
    );
    this.isRunning = false;

    // Aguarda o loop corrente finalizar (com timeout de segurança de até 20 segundos)
    const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 20_000));
    await Promise.race([this.loopPromise, timeoutPromise]);
    this.logger.log("PendingReferenceResolverWorker finalizado com sucesso");
  }

  private async loop(): Promise<void> {
    while (this.isRunning) {
      try {
        const result = await this.resolveUseCase.execute({
          batchSize: this.batchSize,
        });

        // Se o lote estava cheio, drena mais rapidamente as pendências restantes
        if (result.claimedCount >= this.batchSize && this.isRunning) {
          await this.sleep(50);
          continue;
        }
      } catch (err) {
        this.logger.error("Erro no ciclo do PendingReferenceResolverWorker", err);
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
