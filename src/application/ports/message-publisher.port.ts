import type { OutboxMessage } from "../../domain/messaging/outbox-message";

export interface MessagePublisherPort {
  /**
   * Publica uma mensagem de integração no broker de mensageria (AWS SQS FIFO).
   * Lança erro se a publicação falhar (para acionar backoff).
   */
  publish(message: OutboxMessage): Promise<void>;
}
