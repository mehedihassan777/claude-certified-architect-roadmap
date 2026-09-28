"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useContentIndex, useProgress } from "@/client/progress-provider";
import { useNow } from "@/client/use-now";
import { DOMAIN_INFO, type Domain } from "@/lib/content/domains";
import type { ContentIndex } from "@/lib/content/summary";
import { browserTimeZone, formatMinutes, localDateKey } from "@/lib/dates";
import type { Progress } from "@/lib/progress/schema";
import { computeStats, dayState, ratio, type Pace, type Stats } from "@/lib/progress/stats";
import { ArrowRightIcon, CalendarIcon, CheckIcon, ClockIcon, FlameIcon, GaugeIcon, RefreshIcon, TargetIcon } from "./icons";
import {
  buttonStyles,
  Card,
  CardHeader,
  cx,
  DomainChip,
  domainColor,
  DomainDot,
  Eyebrow,
  ProgressBar,
  ProgressRing,
  shortDomainLabel,
  Skeleton,
} from "./ui";

export function Dashboard() {
  const { view, status, loadError, sync } = useProgress();
  const index = useContentIndex();
  const now = useNow();
  const timeZone = useMemo(() => (now === 0 ? "UTC" : browserTimeZone()), [now]);
  const stats = useMemo(() => (view && now !== 0 ? computeStats(index, view, new Date(now), timeZone) : null), [index, view, now, timeZone]);

  if (status === "error" && !view) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <h1 className="font-display text-2xl font-semibold">Couldn&apos;t load your progress</h1>
        <p className="mt-2 text-sm text-ink-2">{loadError}</p>
        <button type="button" className={cx(buttonStyles.primary, "mt-6")} onClick={() => void sync.refresh()}>
          <RefreshIcon className="size-4" /> Try again
        </button>
      </Card>
    );
  }
  if (!view || !stats) return <DashboardSkeleton />;

  const todayKey = localDateKey(new Date(now), timeZone);
  return (
    <div className="space-y-6">
      <Greeting now={now} stats={stats} />

      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <TodayCard stats={stats} progress={view} />
        <OverallCard stats={stats} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <PaceTile stats={stats} onStart={() => sync.dispatch([{ type: "setStartDate", date: todayKey }])} />
        <StatTile
          icon={<FlameIcon />}
          label="Streak"
          value={`${stats.streak.current} ${stats.streak.current === 1 ? "day" : "days"}`}
          hint={
            stats.streak.activeToday
              ? "Studied today"
              : stats.streak.current > 0
                ? "Tick a task today to keep it"
                : "Complete a task to start one"
          }
        />
        <StatTile icon={<CalendarIcon />} label="Days complete" value={`${stats.days.done} / ${stats.days.total}`} hint={`${stats.days.total - stats.days.done} to go`} />
        <StatTile
          icon={<ClockIcon />}
          label="Study time"
          value={formatMinutes(stats.minutes.done)}
          hint={`of ${formatMinutes(stats.minutes.total)} · ${formatMinutes(stats.minutes.total - stats.minutes.done)} left`}
        />
      </div>

      <JourneyGrid index={index} progress={view} todayDay={stats.today?.day ?? null} />

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <WeekProgress stats={stats} />
        <DomainProgress stats={stats} />
      </div>

      <WeakestDomains stats={stats} />
    </div>
  );
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function paceSentence(pace: Pace): string {
  switch (pace.kind) {
    case "unscheduled":
      return "Set a start date to track your pace.";
    case "finished":
      return "Every day is complete. You're ready.";
    case "on-track":
      return "You're on track.";
    case "ahead":
      return `You're ${pace.days} ${pace.days === 1 ? "day" : "days"} ahead of schedule.`;
    case "behind":
      return `You're ${pace.days} ${pace.days === 1 ? "day" : "days"} behind. Nothing's locked; just pick up where you left off.`;
  }
}

function Greeting({ now, stats }: { now: number; stats: Stats }) {
  const date = new Date(now);
  return (
    <div>
      <Eyebrow>{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date)}</Eyebrow>
      <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{greetingFor(date.getHours())}</h1>
      <p className="mt-1.5 text-ink-2">
        {stats.scheduledDay !== null && stats.pace.kind !== "finished" ? `Day ${stats.scheduledDay} of ${stats.days.total} on your schedule. ` : null}
        {stats.startsIn !== null ? `Your plan starts in ${stats.startsIn} ${stats.startsIn === 1 ? "day" : "days"}. ` : null}
        {paceSentence(stats.pace)}
      </p>
    </div>
  );
}

function TodayCard({ stats, progress }: { stats: Stats; progress: Progress }) {
  const day = stats.today;
  if (!day) {
    return (
      <Card className="relative overflow-hidden p-6 sm:p-8 lg:col-span-2">
        <Eyebrow>Roadmap complete</Eyebrow>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">All {stats.days.total} days done.</h2>
        <p className="mt-2 max-w-md text-ink-2">Revisit your weakest domains, reread your notes, and go take the exam.</p>
        <Link href="/roadmap" className={cx(buttonStyles.secondary, "mt-6")}>
          Review the roadmap
        </Link>
      </Card>
    );
  }
  const state = dayState(day, progress);
  const started = state.tasks.done > 0;
  return (
    <Card className="relative overflow-hidden p-6 sm:p-8 lg:col-span-2">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full opacity-[0.10] blur-3xl"
        style={{ backgroundColor: domainColor(day.domain) }}
      />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow>Up next · Week {day.week}</Eyebrow>
          {stats.scheduledDay !== null && stats.scheduledDay !== day.day ? (
            <span className="text-xs text-ink-3">(schedule says Day {stats.scheduledDay})</span>
          ) : null}
        </div>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="font-display text-5xl font-semibold tracking-tight text-accent tabular-nums">{day.day}</span>
          <span className="text-sm font-medium text-ink-3">/ {stats.days.total}</span>
        </div>
        <h2 className="mt-2 max-w-xl font-display text-2xl leading-snug font-semibold tracking-tight text-balance">{day.title}</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <DomainChip domain={day.domain} />
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
            <ClockIcon className="size-3.5" /> {formatMinutes(state.minutes.total - state.minutes.done)} left
          </span>
        </div>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="mb-1.5 flex justify-between text-xs text-ink-2">
              <span>
                {state.tasks.done} of {state.tasks.total} tasks
              </span>
              <span className="tabular-nums">{Math.round(ratio(state.tasks) * 100)}%</span>
            </div>
            <ProgressBar value={ratio(state.tasks)} label={`Day ${day.day} progress`} />
          </div>
          <Link href={`/day/${day.day}`} className={buttonStyles.primary}>
            {started ? "Continue" : "Start"} Day {day.day} <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      </div>
    </Card>
  );
}

function OverallCard({ stats }: { stats: Stats }) {
  const pct = Math.round(ratio(stats.tasks) * 100);
  return (
    <Card className="flex flex-col items-center justify-center gap-5 p-6 text-center sm:flex-row sm:text-left lg:flex-col lg:text-center">
      <ProgressRing value={ratio(stats.tasks)} size={136} stroke={11}>
        <span className="font-display text-3xl font-semibold tabular-nums">
          {pct}
          <span className="text-lg text-ink-3">%</span>
        </span>
        <span className="text-[11px] font-medium text-ink-3">overall</span>
      </ProgressRing>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <dt className="text-ink-3">Tasks</dt>
        <dd className="text-right font-medium tabular-nums">
          {stats.tasks.done} / {stats.tasks.total}
        </dd>
        <dt className="text-ink-3">Hours</dt>
        <dd className="text-right font-medium tabular-nums">
          {(stats.minutes.done / 60).toFixed(1)} / {(stats.minutes.total / 60).toFixed(0)}
        </dd>
      </dl>
    </Card>
  );
}

function StatTile({ icon, label, value, hint, tone, children }: { icon: ReactNode; label: string; value: string; hint?: ReactNode; tone?: "good" | "warn"; children?: ReactNode }) {
  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-3">
        <span className={cx("inline-flex size-6 items-center justify-center rounded-md bg-surface-2 text-sm", tone === "good" && "bg-good-soft text-good", tone === "warn" && "bg-warn-soft text-warn")}>
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-3 font-display text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-3">{hint}</p> : null}
      {children}
    </Card>
  );
}

function PaceTile({ stats, onStart }: { stats: Stats; onStart: () => void }) {
  const { pace } = stats;
  if (pace.kind === "unscheduled") {
    return (
      <StatTile icon={<GaugeIcon />} label="Pace" value="Not started" hint="Set day 1 to today to track pace">
        <button type="button" onClick={onStart} className={cx(buttonStyles.ghost, "mt-2 -ml-2.5 self-start text-accent hover:text-accent-hover")}>
          Start today <ArrowRightIcon className="size-3.5" />
        </button>
      </StatTile>
    );
  }
  const value =
    pace.kind === "finished" ? "Finished" : pace.kind === "on-track" ? "On track" : `${pace.days} ${pace.days === 1 ? "day" : "days"} ${pace.kind}`;
  const hint =
    stats.startsIn !== null ? `Starts in ${stats.startsIn} ${stats.startsIn === 1 ? "day" : "days"}` : stats.scheduledDay !== null ? `Schedule: Day ${stats.scheduledDay}` : undefined;
  return (
    <StatTile
      icon={pace.kind === "behind" ? <GaugeIcon /> : <CheckIcon />}
      label="Pace"
      value={value}
      hint={hint}
      tone={pace.kind === "behind" ? "warn" : "good"}
    />
  );
}

function JourneyGrid({ index, progress, todayDay }: { index: ContentIndex; progress: Progress; todayDay: number | null }) {
  return (
    <Card>
      <CardHeader
        title="Your 42 days"
        description="Each square is a day. Click one to open it."
        action={
          <ul className="hidden items-center gap-4 text-xs text-ink-2 sm:flex">
            <LegendItem swatch="bg-accent" label="Done" />
            <LegendItem swatch="bg-accent-soft ring-1 ring-inset ring-accent/40" label="In progress" />
            <LegendItem swatch="bg-surface-3" label="Not started" />
          </ul>
        }
      />
      <div className="space-y-2 px-5 pt-4 pb-5">
        {index.weeks.map((week) => (
          <div key={week.week} className="flex items-center gap-3">
            <span className="w-9 shrink-0 text-xs font-medium text-ink-3">W{week.week}</span>
            <div className="grid flex-1 grid-cols-7 gap-1.5 sm:gap-2">
              {index.days
                .filter((day) => day.week === week.week)
                .map((day) => {
                  const state = dayState(day, progress);
                  const isToday = day.day === todayDay;
                  return (
                    <Link
                      key={day.day}
                      href={`/day/${day.day}`}
                      title={`Day ${day.day}: ${day.title} · ${state.tasks.done}/${state.tasks.total} tasks`}
                      aria-label={`Day ${day.day}: ${day.title}. ${state.tasks.done} of ${state.tasks.total} tasks done${isToday ? ", up next" : ""}`}
                      className={cx(
                        "group relative flex h-10 items-center justify-center rounded-lg text-xs font-semibold tabular-nums transition-transform hover:-translate-y-0.5 sm:h-12",
                        state.status === "done" && "bg-accent text-accent-ink",
                        state.status === "in-progress" && "bg-accent-soft text-accent-soft-ink ring-1 ring-accent/40 ring-inset",
                        state.status === "not-started" && "bg-surface-2 text-ink-3 hover:bg-surface-3",
                        isToday && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
                      )}
                    >
                      {state.status === "done" ? <CheckIcon className="size-4" /> : day.day}
                      <span
                        aria-hidden="true"
                        className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full"
                        style={{ backgroundColor: state.status === "done" ? "transparent" : domainColor(day.domain) }}
                      />
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
        <ul className="flex flex-wrap items-center gap-4 pt-2 text-xs text-ink-2 sm:hidden">
          <LegendItem swatch="bg-accent" label="Done" />
          <LegendItem swatch="bg-accent-soft ring-1 ring-inset ring-accent/40" label="In progress" />
          <LegendItem swatch="bg-surface-3" label="Not started" />
        </ul>
      </div>
    </Card>
  );
}

function LegendItem({ swatch, label }: { swatch: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={cx("size-3 rounded-[4px]", swatch)} aria-hidden="true" />
      {label}
    </li>
  );
}

function MeterRow({ label, sub, value, color, labelPrefix }: { label: string; sub?: string; value: number; color?: string; labelPrefix?: ReactNode }) {
  const pct = Math.round(value * 100);
  return (
    <li>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          {labelPrefix}
          <span className="truncate font-medium text-ink">{label}</span>
          {sub ? <span className="shrink-0 text-xs text-ink-3">{sub}</span> : null}
        </span>
        <span className="shrink-0 text-xs font-medium text-ink-2 tabular-nums">{pct}%</span>
      </div>
      <ProgressBar value={value} color={color} label={`${label}: ${pct}%`} />
    </li>
  );
}

function WeekProgress({ stats }: { stats: Stats }) {
  return (
    <Card>
      <CardHeader title="By week" description="Share of each week's tasks done" />
      <ul className="space-y-4 p-5">
        {stats.byWeek.map((week) => (
          <MeterRow key={week.week} label={week.title} labelPrefix={<span className="w-6 shrink-0 text-xs font-semibold text-ink-3">W{week.week}</span>} value={ratio(week.tasks)} />
        ))}
      </ul>
    </Card>
  );
}

function domainOrder(domain: Domain): number {
  const exam = DOMAIN_INFO[domain].exam;
  if (exam) return exam.number;
  return domain === "foundations" ? 10 : 11;
}

function DomainProgress({ stats }: { stats: Stats }) {
  const rows = [...stats.byDomain].sort((a, b) => domainOrder(a.domain) - domainOrder(b.domain));
  return (
    <Card>
      <CardHeader title="By domain" description="Exam weight shown beside each exam domain" />
      <ul className="space-y-4 p-5">
        {rows.map((row) => {
          const exam = DOMAIN_INFO[row.domain].exam;
          return (
            <MeterRow
              key={row.domain}
              label={shortDomainLabel(row.domain)}
              sub={exam ? `${exam.weight}% of exam` : undefined}
              labelPrefix={<DomainDot domain={row.domain} />}
              value={ratio(row.tasks)}
              color={domainColor(row.domain)}
            />
          );
        })}
      </ul>
    </Card>
  );
}

function WeakestDomains({ stats }: { stats: Stats }) {
  const weakest = stats.weakest.slice(0, 3);
  return (
    <Card>
      <CardHeader title="Weakest domains" description="Average of your end-of-day confidence ratings (1–5), exam practice excluded" action={<TargetIcon className="size-5 text-ink-3" />} />
      {weakest.length === 0 ? (
        <p className="px-5 pt-3 pb-5 text-sm text-ink-2">Rate your confidence at the end of each day and your weak spots will show up here.</p>
      ) : (
        <ul className="grid gap-3 p-5 sm:grid-cols-3">
          {weakest.map((entry, i) => (
            <li key={entry.domain} className="rounded-xl border border-line bg-surface-2/50 p-4">
              <div className="flex items-center justify-between gap-2">
                <DomainChip domain={entry.domain} short className="bg-surface" />
                {i === 0 ? <span className="text-[11px] font-semibold text-warn uppercase">Focus</span> : null}
              </div>
              <p className="mt-3 font-display text-2xl font-semibold tabular-nums">
                {entry.average.toFixed(1)}
                <span className="text-sm text-ink-3"> / 5</span>
              </p>
              <div className="mt-2 flex gap-1" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={cx("h-1.5 flex-1 rounded-full", n <= Math.round(entry.average) ? "bg-ink-2" : "bg-surface-3")} />
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-3">
                {entry.rated} {entry.rated === 1 ? "day" : "days"} rated
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading progress">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
