import { InvariantViolation } from "../errors/domain-error";

export interface InboxProps {
  consumerName: string;
  messageId: string;
  payloadHash: string;
  receivedAt: Date;
  processedAt: Date | null;
}

export class InboxMessage {
  private constructor(private p: InboxProps) {}

  static receive(args: { consumerName: string; messageId: string; payloadHash: string; now: Date }): InboxMessage {
    return new InboxMessage({
      consumerName: args.consumerName,
      messageId: args.messageId,
      payloadHash: args.payloadHash,
      receivedAt: args.now,
      processedAt: null,
    });
  }

  static rehydrate(props: InboxProps): InboxMessage {
    return new InboxMessage({ ...props });
  }

  get props(): Readonly<InboxProps> { return this.p; }
  get isProcessed(): boolean { return this.p.processedAt !== null; }

  markProcessed(now: Date): void {
    if (this.isProcessed) throw new InvariantViolation("Inbox message already processed");
    this.p.processedAt = now;
  }
}
