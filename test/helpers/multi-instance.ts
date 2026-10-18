import { createServer } from "node:net";

const START_TIMEOUT_MS = 15_000;
const STOP_TIMEOUT_MS = 10_000;

export interface AppInstance {
  id: string;
  port: number;
  baseUrl: string;
  process: ReturnType<typeof Bun.spawn>;
  stdout: string[];
  stderr: string[];
}

export interface StartAppInstanceOptions {
  id: string;
  databaseUrl: string;
  appRole?: "all" | "api" | "consumer" | "outbox" | "resolver";
  environment?: Record<string, string>;
  entrypoint?: string;
}

export async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not reserve an IPv4 port"));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

export async function startAppInstance(options: StartAppInstanceOptions): Promise<AppInstance> {
  const port = await reservePort();
  const stdout: string[] = [];
  const stderr: string[] = [];
  const child = Bun.spawn({
    cmd: [process.execPath, options.entrypoint ?? "src/main.ts"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...options.environment,
      APP_ROLE: options.appRole ?? "api",
      DATABASE_URL: options.databaseUrl,
      INSTANCE_ID: options.id,
      PORT: String(port),
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  void collectOutput(child.stdout, stdout);
  void collectOutput(child.stderr, stderr);

  const instance: AppInstance = {
    id: options.id,
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    process: child,
    stdout,
    stderr,
  };

  try {
    if (options.entrypoint) await waitForLog(instance, "consumer fixture ready");
    else await waitForReady(instance);
    return instance;
  } catch (error) {
    await stopAppInstance(instance);
    throw new Error(`${errorMessage(error)}\n${formatInstanceLogs(instance)}`);
  }
}

export async function startAppInstances(
  count: number,
  options: Omit<StartAppInstanceOptions, "id">,
): Promise<AppInstance[]> {
  const instances: AppInstance[] = [];
  try {
    for (let index = 1; index <= count; index++) {
      instances.push(await startAppInstance({ ...options, id: `phase-08-${index}` }));
    }
    return instances;
  } catch (error) {
    await stopAppInstances(instances);
    throw error;
  }
}

export async function stopAppInstance(instance: AppInstance): Promise<void> {
  if (instance.process.exitCode !== null) return;
  instance.process.kill("SIGTERM");
  const exited = await Promise.race([
    instance.process.exited.then(() => true),
    sleep(STOP_TIMEOUT_MS).then(() => false),
  ]);
  if (!exited && instance.process.exitCode === null) {
    instance.process.kill("SIGKILL");
    await instance.process.exited;
  }
}

export async function stopAppInstances(instances: readonly AppInstance[]): Promise<void> {
  await Promise.all(instances.map((instance) => stopAppInstance(instance)));
}

export async function waitForReady(instance: AppInstance, timeoutMs = START_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (instance.process.exitCode !== null) {
      throw new Error(`Instance ${instance.id} exited before readiness`);
    }
    try {
      const response = await fetch(`${instance.baseUrl}/health/ready`);
      if (response.status === 200) return;
    } catch {
      // The HTTP listener is not ready yet.
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${instance.id} at ${instance.baseUrl}/health/ready`);
}

export function formatInstanceLogs(instance: AppInstance): string {
  return [
    `Instance ${instance.id} (${instance.baseUrl})`,
    "stdout:",
    instance.stdout.join("").slice(-8_000),
    "stderr:",
    instance.stderr.join("").slice(-8_000),
  ].join("\n");
}


async function collectOutput(stream: ReadableStream<Uint8Array>, destination: string[]): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      destination.push(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function waitForLog(instance: AppInstance, marker: string, timeoutMs = START_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (instance.stdout.join("").includes(marker)) return;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for log '${marker}' in ${instance.id}:\n${formatInstanceLogs(instance)}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
