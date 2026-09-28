/**
 * Calendar-date helpers. A date key is "YYYY-MM-DD" with no time zone. Instants (UTC timestamps)
 * become date keys only through an explicit time zone, so the tests can pin one.
 */

const MS_PER_DAY = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function keyFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The calendar date of an instant in the given IANA time zone. */
export function localDateKey(instant: Date | string, timeZone: string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  const parts = keyFormatter(timeZone).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function keyToUtc(key: string): number {
  const [year = 0, month = 1, day = 1] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function addDays(key: string, days: number): string {
  return new Date(keyToUtc(key) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). DST never shifts it. */
export function daysBetween(from: string, to: string): number {
  return Math.round((keyToUtc(to) - keyToUtc(from)) / MS_PER_DAY);
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Formats a date key for display without letting any time zone move it. */
export function formatDateKey(key: string, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(keyToUtc(key));
}

/** "2h 15m", "45m", "3h". */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
