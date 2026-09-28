/** Runs once when a server instance starts: bad storage settings stop it with a clear message. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getStorageConfig } = await import("./lib/env");
  getStorageConfig();
}
