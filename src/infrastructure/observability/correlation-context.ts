import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface CorrelationData {
  correlationId: string;
  instanceId?: string;
  walletId?: string;
  transactionId?: string;
  providerId?: string;
  externalTransactionId?: string;
  messageId?: string;
  [key: string]: unknown;
}

const asyncLocalStorage = new AsyncLocalStorage<CorrelationData>();

export const CorrelationContext = {
  run<T>(data: CorrelationData, fn: () => T): T {
    return asyncLocalStorage.run(data, fn);
  },

  get(): CorrelationData | undefined {
    return asyncLocalStorage.getStore();
  },

  getCorrelationId(): string {
    return asyncLocalStorage.getStore()?.correlationId ?? randomUUID();
  },

  merge(additional: Partial<CorrelationData>): void {
    const store = asyncLocalStorage.getStore();
    if (store) {
      Object.assign(store, additional);
    }
  },
};
