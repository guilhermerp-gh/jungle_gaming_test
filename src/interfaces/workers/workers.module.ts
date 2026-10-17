import { type DynamicModule, Module, type Provider } from "@nestjs/common";
import { MikroORM } from "@mikro-orm/postgresql";
import type { MessagePublisherPort } from "../../application/ports/message-publisher.port";
import type { UnitOfWork } from "../../application/ports/unit-of-work.port";
import { PublishOutboxMessagesUseCase } from "../../application/use-cases/publish-outbox-messages.use-case";
import { loadConfig } from "../../infrastructure/config/config";
import { defaultOutboxMetrics, OutboxMetrics } from "../../infrastructure/observability/outbox-metrics";
import { createOrmConfig } from "../../infrastructure/persistence/mikro-orm/orm-config";
import { MikroOrmUnitOfWork } from "../../infrastructure/persistence/repositories/mikro-orm-uow";
import { SqsMessagePublisher } from "../../infrastructure/sqs/sqs-message-publisher";
import { OutboxPublisherWorker } from "./outbox-publisher.worker";

export const WORKERS_MESSAGE_PUBLISHER = "WORKERS_MESSAGE_PUBLISHER";
export const WORKERS_UNIT_OF_WORK = "WORKERS_UNIT_OF_WORK";
export const WORKERS_MIKRO_ORM = "WORKERS_MIKRO_ORM";

export interface WorkersModuleOptions {
  orm?: MikroORM;
  uow?: UnitOfWork;
  publisher?: MessagePublisherPort;
  metrics?: OutboxMetrics;
}

@Module({})
export class WorkersModule {
  static register(options?: WorkersModuleOptions): DynamicModule {
    const config = loadConfig();

    const providers: Provider[] = [
      {
        provide: OutboxMetrics,
        useValue: options?.metrics ?? defaultOutboxMetrics,
      },
      {
        provide: WORKERS_MESSAGE_PUBLISHER,
        useFactory: () => {
          if (options?.publisher) return options.publisher;
          return new SqsMessagePublisher({
            queueUrl: config.EVENTS_QUEUE_URL,
            endpoint: config.AWS_ENDPOINT_URL,
            region: config.AWS_REGION,
          });
        },
      },
      {
        provide: PublishOutboxMessagesUseCase,
        useFactory: (uow: UnitOfWork, publisher: MessagePublisherPort, metrics: OutboxMetrics) => {
          return new PublishOutboxMessagesUseCase(uow, publisher, metrics);
        },
        inject: [WORKERS_UNIT_OF_WORK, WORKERS_MESSAGE_PUBLISHER, OutboxMetrics],
      },
      OutboxPublisherWorker,
    ];

    if (options?.uow) {
      providers.push({
        provide: WORKERS_UNIT_OF_WORK,
        useValue: options.uow,
      });
    } else if (options?.orm) {
      providers.push(
        {
          provide: WORKERS_MIKRO_ORM,
          useValue: options.orm,
        },
        {
          provide: WORKERS_UNIT_OF_WORK,
          useFactory: (orm: MikroORM) => new MikroOrmUnitOfWork(orm),
          inject: [WORKERS_MIKRO_ORM],
        },
      );
    } else {
      providers.push(
        {
          provide: WORKERS_MIKRO_ORM,
          useFactory: async () => MikroORM.init(createOrmConfig()),
        },
        {
          provide: WORKERS_UNIT_OF_WORK,
          useFactory: (orm: MikroORM) => new MikroOrmUnitOfWork(orm),
          inject: [WORKERS_MIKRO_ORM],
        },
      );
    }

    return {
      module: WorkersModule,
      providers,
      exports: [OutboxPublisherWorker, PublishOutboxMessagesUseCase, WORKERS_MESSAGE_PUBLISHER],
    };
  }
}
