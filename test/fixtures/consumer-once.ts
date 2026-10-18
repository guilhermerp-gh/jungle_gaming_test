import "reflect-metadata";
import { ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { MikroORM } from "@mikro-orm/postgresql";
import { ProcessWagerTransactionUseCase } from "../../src/application/use-cases/process-wager-transaction.use-case";
import { createOrmConfig } from "../../src/infrastructure/persistence/mikro-orm/orm-config";
import { MikroOrmUnitOfWork } from "../../src/infrastructure/persistence/repositories/mikro-orm-uow";
import { WagerTransactionsConsumerWorker } from "../../src/interfaces/workers/wager-transactions-consumer.worker";
const client = new SQSClient({ region: "us-east-1", endpoint: process.env.AWS_ENDPOINT_URL, credentials: { accessKeyId: "test", secretAccessKey: "test" } });
const visibilityTimeout = Number(process.env.VISIBILITY_TIMEOUT ?? "2");
let message = null;
const deadline = Date.now() + 10_000;
while (Date.now() < deadline) {
  const result = await client.send(
    new ReceiveMessageCommand({
      QueueUrl: process.env.WAGER_QUEUE_URL,
      MaxNumberOfMessages: 1,
      VisibilityTimeout: visibilityTimeout,
      WaitTimeSeconds: 2,
    }),
  );
  if (result.Messages?.[0]) {
    message = result.Messages[0];
    break;
  }
}
console.log(JSON.stringify({ msg: "consumer fixture ready", received: message ? 1 : 0 }));
if (message) {
  const orm = await MikroORM.init(createOrmConfig());
  try {
    const worker = new WagerTransactionsConsumerWorker(
      new ProcessWagerTransactionUseCase(new MikroOrmUnitOfWork(orm)),
      { queueUrl: process.env.WAGER_QUEUE_URL, endpoint: process.env.AWS_ENDPOINT_URL },
    );
    await worker.processSingleMessage(message);
  } finally {
    await orm.close(true);
  }
}
