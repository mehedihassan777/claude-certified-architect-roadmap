"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { useProgress } from "@/client/progress-provider";
import { setThemePreference, useThemePreference, type ThemePreference } from "@/client/theme";
import { AlertIcon, CloudCheckIcon, LogoMark, MonitorIcon, MoonIcon, SpinnerIcon, SunIcon } from "./icons";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/settings", label: "Settings" },
] as const;

export interface HeaderUser {
  email: string | null;
  isAdmin: boolean;
}

export function SiteHeader({ user }: { user: HeaderUser }) {
  const pathname = usePathname();
  const nav = user.isAdmin ? [...NAV, { href: "/admin", label: "Admin" } as const] : NAV;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/roadmap" && pathname.startsWith("/day")));

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg">
          <LogoMark className="size-7" />
          <span className="hidden font-display text-[17px] font-semibold tracking-tight sm:inline">CCA-F Roadmap</span>
        </Link>
        <nav aria-label="Main" className="flex min-w-0 items-center gap-0.5">
          {nav.map((item) => (
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
          <AccountMenu user={user} />
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

function AccountMenu({ user }: { user: HeaderUser }) {
  const initial = (user.email?.[0] ?? "?").toUpperCase();
  return (
    <details className="group relative">
      <summary
        aria-label="Account"
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-ink-2 ring-accent transition-colors select-none hover:bg-surface-3 group-open:ring-2 [&::-webkit-details-marker]:hidden"
      >
        {initial}
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-lg">
        <div className="px-3 py-2">
          <p className="text-xs text-ink-3">Signed in as</p>
          <p className="truncate text-sm font-medium" title={user.email ?? undefined}>
            {user.email ?? "Unknown email"}
          </p>
          {user.isAdmin ? <p className="mt-1 inline-block rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-accent-soft-ink uppercase">Admin</p> : null}
        </div>
        <div className="my-1 h-px bg-line" />
        <form action={signOut}>
          <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
