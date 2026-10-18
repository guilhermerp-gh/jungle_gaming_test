export async function waitForFailureInjection(key: string): Promise<void> {
  const value = process.env[key];
  if (!value) return;
  console.log(JSON.stringify({ msg: "test hook reached", hook: key }));
  await new Promise<void>((resolve) => setTimeout(resolve, Number(value)));
}
