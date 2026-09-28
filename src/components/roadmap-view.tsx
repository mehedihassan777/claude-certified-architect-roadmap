"use client";

import Link from "next/link";
import { useState } from "react";
import { useContentIndex, useProgress } from "@/client/progress-provider";
import { DOMAIN_INFO, DOMAINS, type Domain } from "@/lib/content/domains";
import { isReviewDay } from "@/lib/content/rules";
import { formatMinutes } from "@/lib/dates";
import { dayState, ratio, type DayState } from "@/lib/progress/stats";
import { ArrowRightIcon, CheckIcon, ClockIcon } from "./icons";
import { Card, cx, DomainChip, DomainDot, ProgressBar, shortDomainLabel } from "./ui";

export function RoadmapView() {
  const index = useContentIndex();
  const { view } = useProgress();
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [domain, setDomain] = useState<Domain | "all">("all");

  const presentDomains = DOMAINS.filter((d) => index.days.some((day) => day.domain === d));
  const firstIncomplete = view ? index.days.find((day) => dayState(day, view).status !== "done")?.day : undefined;

  const weeks = index.weeks
    .map((week) => {
      const days = index.days
        .filter((day) => day.week === week.week)
        .map((day) => ({ day, state: view ? dayState(day, view) : null }));
      const done = days.filter((d) => d.state?.status === "done").length;
      const tasks = days.reduce((sum, d) => ({ done: sum.done + (d.state?.tasks.done ?? 0), total: sum.total + d.day.tasks.length }), { done: 0, total: 0 });
      const shown = days.filter(
        ({ day, state }) => (domain === "all" || day.domain === domain) && (!incompleteOnly || state?.status !== "done"),
      );
      return { ...week, days: shown, done, count: days.length, tasks };
    })
    .filter((week) => week.days.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card sm:flex-row sm:items-center">
        <label className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm font-medium select-none">
          <span className="relative inline-flex">
            <input type="checkbox" className="peer sr-only" checked={incompleteOnly} onChange={(e) => setIncompleteOnly(e.target.checked)} />
            <span className="h-5 w-9 rounded-full bg-surface-3 transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
            <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </span>
          Incomplete only
        </label>
        <div className="hidden h-6 w-px bg-line sm:block" />
        <div role="group" aria-label="Filter by domain" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:pb-0">
          <FilterChip active={domain === "all"} onClick={() => setDomain("all")}>
            All domains
          </FilterChip>
          {presentDomains.map((d) => (
            <FilterChip key={d} active={domain === d} onClick={() => setDomain(d)}>
              <DomainDot domain={d} />
              {shortDomainLabel(d)}
            </FilterChip>
          ))}
        </div>
      </div>

      {weeks.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="font-display text-xl font-semibold">Nothing left here</p>
          <p className="mt-1 text-sm text-ink-2">Every day matching these filters is complete.</p>
        </Card>
      ) : null}

      {weeks.map((week) => (
        <section key={week.week} aria-labelledby={`week-${week.week}`}>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Week {week.week}</p>
              <h2 id={`week-${week.week}`} className="font-display text-xl font-semibold tracking-tight">
                {week.title}
              </h2>
            </div>
            <div className="flex items-center gap-3 sm:w-64">
              <ProgressBar value={ratio(week.tasks)} label={`Week ${week.week} progress`} size="sm" />
              <span className="shrink-0 text-xs text-ink-2 tabular-nums">
                {week.done}/{week.count} days
              </span>
            </div>
          </div>
          <Card className="overflow-hidden">
            <ol className="divide-y divide-line">
              {week.days.map(({ day, state }) => (
                <li key={day.day}>
                  <Link
                    href={`/day/${day.day}`}
                    className={cx("group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2/60 sm:px-5", day.day === firstIncomplete && "bg-accent-soft/40")}
                  >
                    <StatusBadge day={day.day} state={state} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-semibold text-ink-3 tabular-nums">Day {day.day}</span>
                        {day.day === firstIncomplete ? <span className="rounded-full bg-accent px-2 py-px text-[10px] font-bold tracking-wide text-accent-ink uppercase">Up next</span> : null}
                        {isReviewDay(day.day) ? <span className="rounded-full border border-line-strong px-2 py-px text-[10px] font-semibold tracking-wide text-ink-2 uppercase">Review</span> : null}
                      </div>
                      <p className={cx("mt-0.5 font-medium text-pretty", state?.status === "done" ? "text-ink-2" : "text-ink")}>{day.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
                        <DomainChip domain={day.domain} short />
                      </div>
                    </div>
                    <div className="hidden w-44 shrink-0 md:block">
                      <DomainChip domain={day.domain} short />
                    </div>
                    <div className="hidden w-20 shrink-0 items-center gap-1.5 text-xs text-ink-2 sm:flex">
                      <ClockIcon className="size-3.5 text-ink-3" />
                      {formatMinutes(day.estMinutes)}
                    </div>
                    <div className="hidden w-14 shrink-0 text-right text-xs text-ink-2 tabular-nums sm:block">
                      {state ? `${state.tasks.done}/${state.tasks.total}` : "–"}
                    </div>
                    <ArrowRightIcon className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      ))}
      <p className="text-center text-xs text-ink-3">
        {Object.values(DOMAIN_INFO).filter((d) => d.exam).length} exam domains · {index.days.length} days · {formatMinutes(index.days.reduce((s, d) => s + d.estMinutes, 0))} planned
      </p>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
        active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function StatusBadge({ day, state }: { day: number; state: DayState | null }) {
  if (state?.status === "done") {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink" aria-label="Done">
        <CheckIcon className="size-4" />
      </span>
    );
  }
  const value = state ? ratio(state.tasks) : 0;
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center" aria-label={state?.status === "in-progress" ? "In progress" : "Not started"}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="2.5" />
        {value > 0 ? <circle cx="18" cy="18" r={r} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} /> : null}
      </svg>
      <span className="text-xs font-semibold text-ink-2 tabular-nums">{day}</span>
    </span>
  );
}
