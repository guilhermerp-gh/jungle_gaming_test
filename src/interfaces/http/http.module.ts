import { type DynamicModule, type MiddlewareConsumer, Module, type NestModule, type Provider } from "@nestjs/common";
import { CorrelationIdMiddleware } from "./middlewares/correlation-id.middleware";
import { MikroORM } from "@mikro-orm/postgresql";
import type { UnitOfWork } from "../../application/ports/unit-of-work.port";
import {
  CreateWalletUseCase,
  DepositUseCase,
  GetLedgerUseCase,
  GetTransactionUseCase,
  GetWalletUseCase,
  ProcessWagerTransactionUseCase,
  ReconcileWalletUseCase,
} from "../../application/use-cases";
import { createOrmConfig } from "../../infrastructure/persistence/mikro-orm/orm-config";
import { MikroOrmUnitOfWork } from "../../infrastructure/persistence/repositories/mikro-orm-uow";
import { ProvidersTransactionsController } from "./controllers/providers-transactions.controller";
import { TransactionsController } from "./controllers/transactions.controller";
import { WalletsController } from "./controllers/wallets.controller";
import { AuthGuard } from "./guards/auth.guard";

export const UNIT_OF_WORK = "UNIT_OF_WORK";
export const MIKRO_ORM = "MIKRO_ORM";

export interface HttpModuleOptions {
  orm?: MikroORM;
  uow?: UnitOfWork;
}

function buildProviders(options?: HttpModuleOptions): Provider[] {
  const providers: Provider[] = [
    AuthGuard,
    {
      provide: CreateWalletUseCase,
      useFactory: (uow: UnitOfWork) => new CreateWalletUseCase(uow),
      inject: [UNIT_OF_WORK],
    },
    {
      provide: DepositUseCase,
      useFactory: (uow: UnitOfWork) => new DepositUseCase(uow),
      inject: [UNIT_OF_WORK],
    },
    {
      provide: GetWalletUseCase,
      useFactory: (uow: UnitOfWork) => new GetWalletUseCase(uow),
      inject: [UNIT_OF_WORK],
    },
    {
      provide: GetLedgerUseCase,
      useFactory: (uow: UnitOfWork) => new GetLedgerUseCase(uow),
      inject: [UNIT_OF_WORK],
    },
    {
      provide: ReconcileWalletUseCase,
      useFactory: (uow: UnitOfWork) => new ReconcileWalletUseCase(uow),
      inject: [UNIT_OF_WORK],
    },
    {
      provide: ProcessWagerTransactionUseCase,
      useFactory: (uow: UnitOfWork) => new ProcessWagerTransactionUseCase(uow),
      inject: [UNIT_OF_WORK],
    },
    {
      provide: GetTransactionUseCase,
      useFactory: (uow: UnitOfWork) => new GetTransactionUseCase(uow),
      inject: [UNIT_OF_WORK],
    },
  ];

  if (options?.uow) {
    providers.push({
      provide: UNIT_OF_WORK,
      useValue: options.uow,
    });
  } else if (options?.orm) {
    providers.push(
      {
        provide: MIKRO_ORM,
        useValue: options.orm,
      },
      {
        provide: UNIT_OF_WORK,
        useFactory: (orm: MikroORM) => new MikroOrmUnitOfWork(orm),
        inject: [MIKRO_ORM],
      },
    );
  } else {
    providers.push(
      {
        provide: MIKRO_ORM,
        useFactory: async () => MikroORM.init(createOrmConfig()),
      },
      {
        provide: UNIT_OF_WORK,
        useFactory: (orm: MikroORM) => new MikroOrmUnitOfWork(orm),
        inject: [MIKRO_ORM],
      },
    );
  }

  return providers;
}

@Module({
  controllers: [WalletsController, TransactionsController, ProvidersTransactionsController],
  providers: buildProviders(),
  exports: [UNIT_OF_WORK, MIKRO_ORM, AuthGuard],
})
export class HttpModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }

  static register(options?: HttpModuleOptions): DynamicModule {
    return {
      module: HttpModule,
      controllers: [WalletsController, TransactionsController, ProvidersTransactionsController],
      providers: buildProviders(options),
      exports: [UNIT_OF_WORK, MIKRO_ORM, AuthGuard],
    };
  }
}
