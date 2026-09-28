/** Runs once when a server instance starts: missing Supabase settings are logged with a clear message. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getSupabaseConfig } = await import("./lib/env");
  try {
    getSupabaseConfig();
  } catch (error) {
    // Logged rather than thrown, so the proxy can show the same message in the browser.
    console.error(error instanceof Error ? error.message : error);
  }
}
