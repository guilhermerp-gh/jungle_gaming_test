import { z } from "zod";

const schema = z.object({
  APP_ROLE: z.enum(["all", "api", "consumer", "outbox", "resolver"]).default("all"),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().url(),
  AWS_ENDPOINT_URL: z.string().url().optional(),
  AWS_REGION: z.string().default("us-east-1"),
  WAGER_QUEUE_URL: z.string().url(),
  EVENTS_QUEUE_URL: z.string().url(),
  DLQ_QUEUE_URL: z.string().url().optional(),
  RESOLVER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
  RESOLVER_TTL_SECONDS: z.coerce.number().int().positive().default(900),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  return schema.parse(env);
}
