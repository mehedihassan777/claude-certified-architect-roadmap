"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProgress } from "@/client/progress-provider";
import { setThemePreference, useThemePreference, type ThemePreference } from "@/client/theme";
import { AlertIcon, CloudCheckIcon, LogoMark, MonitorIcon, MoonIcon, SpinnerIcon, SunIcon } from "./icons";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/settings", label: "Settings" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/roadmap" && pathname.startsWith("/day")));

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg">
          <LogoMark className="size-7" />
          <span className="hidden font-display text-[17px] font-semibold tracking-tight sm:inline">CCA-F Roadmap</span>
        </Link>
        <nav aria-label="Main" className="flex min-w-0 items-center gap-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cx(
                "rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3",
                isActive(item.href) ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/70 hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <SaveStatus />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function SaveStatus() {
  const { status, save, saveError, sync } = useProgress();
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-bad">
        <AlertIcon className="size-4" />
        <span className="hidden sm:inline">Offline</span>
      </span>
    );
  }
  if (save === "failed") {
    return (
      <button
        type="button"
        onClick={() => sync.retry()}
        title={saveError ?? undefined}
        className="inline-flex items-center gap-1.5 rounded-lg bg-bad-soft px-2.5 py-1 text-xs font-semibold text-bad transition-opacity hover:opacity-80"
      >
        <AlertIcon className="size-4" />
        Failed – Retry
      </button>
    );
  }
  if (save === "saving") {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-ink-3">
        <SpinnerIcon className="size-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  if (save === "saved") {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-ink-3">
        <CloudCheckIcon className="size-4 text-good" />
        <span className="hidden sm:inline">Saved</span>
      </span>
    );
  }
  return null;
}

const THEME_ORDER: ThemePreference[] = ["system", "light", "dark"];
const THEME_LABEL: Record<ThemePreference, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

function ThemeToggle() {
  const preference = useThemePreference();
  const next = THEME_ORDER[(THEME_ORDER.indexOf(preference) + 1) % THEME_ORDER.length] ?? "system";
  const IconFor = preference === "light" ? SunIcon : preference === "dark" ? MoonIcon : MonitorIcon;
  return (
    <button
      type="button"
      onClick={() => setThemePreference(next)}
      aria-label={`${THEME_LABEL[preference]}. Switch to ${THEME_LABEL[next].toLowerCase()}`}
      title={THEME_LABEL[preference]}
      className="inline-flex size-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <IconFor className="size-[18px]" />
    </button>
  );
}
