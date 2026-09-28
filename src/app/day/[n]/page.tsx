import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfidencePicker, DayProgress, NotesEditor, SelfCheckList, TaskList } from "@/components/day-parts";
import { ArrowLeftIcon, ArrowRightIcon, BookIcon, ClockIcon, LightbulbIcon, TargetIcon } from "@/components/icons";
import { Card, cx, DomainChip, Eyebrow } from "@/components/ui";
import { DAYS, getDay } from "@/lib/content";
import { TASK_STATEMENT_TITLES } from "@/lib/content/domains";
import { isReviewDay, TOTAL_DAYS } from "@/lib/content/rules";
import { formatMinutes } from "@/lib/dates";

export const dynamicParams = false;

export function generateStaticParams() {
  return DAYS.map((day) => ({ n: String(day.day) }));
}

function dayFromParam(n: string) {
  return /^\d+$/.test(n) ? getDay(Number(n)) : undefined;
}

export async function generateMetadata({ params }: PageProps<"/day/[n]">): Promise<Metadata> {
  const day = dayFromParam((await params).n);
  return { title: day ? `Day ${day.day}: ${day.title}` : "Day not found" };
}

export default async function DayPage({ params }: PageProps<"/day/[n]">) {
  const day = dayFromParam((await params).n);
  if (!day) notFound();
  const prev = day.day > 1 ? getDay(day.day - 1) : undefined;
  const next = day.day < TOTAL_DAYS ? getDay(day.day + 1) : undefined;

  return (
    <article className="space-y-8">
      <header className="space-y-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-3">
          <Link href="/roadmap" className="hover:text-ink">
            Roadmap
          </Link>
          <span aria-hidden="true">/</span>
          <span>Week {day.week}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow className="text-accent">Day {day.day}</Eyebrow>
          {isReviewDay(day.day) ? <span className="rounded-full border border-line-strong px-2 py-px text-[10px] font-semibold tracking-wide text-ink-2 uppercase">Review day</span> : null}
        </div>
        <h1 className="max-w-3xl font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">{day.title}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <DomainChip domain={day.domain} />
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
            <ClockIcon className="size-4 text-ink-3" /> {formatMinutes(day.estMinutes)}
          </span>
          <DayProgress taskIds={day.tasks.map((task) => task.id)} />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="objectives">
            <SectionTitle id="objectives" icon={<TargetIcon />}>
              Objectives
            </SectionTitle>
            <ul className="space-y-2">
              {day.objectives.map((objective) => (
                <li key={objective} className="flex gap-3 text-ink-2">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <span className="leading-relaxed">{objective}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="tasks">
            <SectionTitle id="tasks" icon={<BookIcon />}>
              Tasks
            </SectionTitle>
            <TaskList tasks={day.tasks} />
          </section>

          <section aria-labelledby="self-check">
            <SectionTitle id="self-check" icon={<LightbulbIcon />}>
              Self-check · {day.selfCheck.length} questions
            </SectionTitle>
            <SelfCheckList items={day.selfCheck} />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Key points</h2>
            <ol className="mt-3 space-y-2.5">
              {day.keyPoints.map((point, i) => (
                <li key={point} className="flex gap-3 text-sm leading-relaxed text-ink-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-2 text-[11px] font-semibold text-ink-3 tabular-nums">{i + 1}</span>
                  {point}
                </li>
              ))}
            </ol>
          </Card>

          {day.connectToExperience ? (
            <Card className="border-accent/30 bg-accent-soft/40 p-5">
              <h2 className="text-sm font-semibold text-accent-soft-ink">Connect to what you know</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{day.connectToExperience}</p>
            </Card>
          ) : null}

          {day.taskStatements ? (
            <Card className="p-5">
              <h2 className="text-sm font-semibold">Exam task statements</h2>
              <ul className="mt-3 space-y-2">
                {day.taskStatements.map((id) => (
                  <li key={id} className="flex gap-2.5 text-sm text-ink-2">
                    <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink">{id}</span>
                    <span className="leading-snug">{TASK_STATEMENT_TITLES[id]}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="text-sm font-semibold">How confident do you feel?</h2>
            <p className="mt-0.5 mb-3 text-xs text-ink-3">Feeds the weakest-domains list on the dashboard.</p>
            <ConfidencePicker day={day.day} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Notes</h2>
            <NotesEditor day={day.day} />
          </Card>
        </aside>
      </div>

      <nav aria-label="Day navigation" className="grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
        {prev ? <DayNavLink direction="prev" day={prev.day} title={prev.title} /> : <span />}
        {next ? <DayNavLink direction="next" day={next.day} title={next.title} /> : null}
      </nav>
    </article>
  );
}

function SectionTitle({ id, icon, children }: { id: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-4 flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight">
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-surface-2 text-base text-ink-2">{icon}</span>
      {children}
    </h2>
  );
}

function DayNavLink({ direction, day, title }: { direction: "prev" | "next"; day: number; title: string }) {
  const isNext = direction === "next";
  return (
    <Link
      href={`/day/${day}`}
      className={cx(
        "group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-line-strong",
        isNext && "flex-row-reverse text-right sm:col-start-2",
      )}
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2 transition-colors group-hover:bg-accent group-hover:text-accent-ink">
        {isNext ? <ArrowRightIcon className="size-4" /> : <ArrowLeftIcon className="size-4" />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-ink-3">{isNext ? "Next" : "Previous"} · Day {day}</span>
        <span className="block truncate text-sm font-semibold">{title}</span>
      </span>
    </Link>
  );
}
