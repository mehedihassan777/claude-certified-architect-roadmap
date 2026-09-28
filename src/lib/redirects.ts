/** Only same-site relative paths, so a crafted ?next= can't send someone to another site after login. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}
