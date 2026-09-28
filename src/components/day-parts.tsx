"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useProgress } from "@/client/progress-provider";
import type { SelfCheck, Task } from "@/lib/content/schema";
import { formatMinutes } from "@/lib/dates";
import { NOTES_MAX_LENGTH } from "@/lib/progress/schema";
import { CheckIcon, ClockIcon, ExternalIcon, XIcon } from "./icons";
import { buttonStyles, cx, ProgressBar, TaskTypeBadge } from "./ui";

/* ---------- Day progress ---------- */

export function DayProgress({ taskIds }: { taskIds: string[] }) {
  const { view } = useProgress();
  const done = view ? taskIds.filter((id) => view.tasks[id]?.done).length : 0;
  const complete = view !== null && done === taskIds.length;
  return (
    <div className="flex w-full items-center gap-3 sm:w-auto">
      <ProgressBar value={done / taskIds.length} label="Tasks done today" className="flex-1 sm:w-40 sm:flex-none" />
      <span className={cx("shrink-0 text-sm font-medium whitespace-nowrap tabular-nums", complete ? "text-good" : "text-ink-2")}>
        {view ? (complete ? "Day complete" : `${done} of ${taskIds.length} tasks`) : "Loading…"}
      </span>
    </div>
  );
}

/* ---------- Tasks ---------- */

export function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <ol className="space-y-3">
      {tasks.map((task, i) => (
        <TaskItem key={task.id} task={task} number={i + 1} />
      ))}
    </ol>
  );
}

function TaskItem({ task, number }: { task: Task; number: number }) {
  const { view, sync } = useProgress();
  const id = useId();
  const done = view?.tasks[task.id]?.done ?? false;
  return (
    <li
      className={cx(
        "group rounded-2xl border bg-surface p-4 shadow-card transition-colors sm:p-5",
        done ? "border-good/30 bg-good-soft/30" : "border-line",
      )}
    >
      <div className="flex gap-4">
        <div className="pt-0.5">
          <input
            id={id}
            type="checkbox"
            className="peer sr-only"
            checked={done}
            disabled={!view}
            onChange={(e) => sync.dispatch([{ type: "setTask", taskId: task.id, done: e.target.checked }])}
          />
          <label
            htmlFor={id}
            className={cx(
              "flex size-6 cursor-pointer items-center justify-center rounded-lg border-2 transition-all peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:cursor-wait peer-disabled:opacity-50",
              done ? "border-good bg-good text-white" : "border-line-strong bg-surface hover:border-accent",
            )}
          >
            <CheckIcon className={cx("size-4 transition-transform", done ? "scale-100" : "scale-0")} strokeWidth={3} />
            <span className="sr-only">Mark “{task.title}” as done</span>
          </label>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-3 tabular-nums">{String(number).padStart(2, "0")}</span>
            <TaskTypeBadge type={task.type} />
            <span className="inline-flex items-center gap-1 text-xs text-ink-3">
              <ClockIcon className="size-3.5" /> {formatMinutes(task.estMinutes)}
            </span>
          </div>
          <label htmlFor={id} className={cx("mt-1.5 block cursor-pointer font-semibold text-pretty transition-colors", done ? "text-ink-2 line-through decoration-ink-3/50" : "text-ink")}>
            {task.title}
          </label>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{task.details}</p>
          {task.resources.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {task.resources.map((resource) => (
                <li key={resource.url}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-ink-2 transition-colors hover:border-accent/50 hover:text-accent"
                  >
                    {resource.title}
                    <ExternalIcon className="size-3" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/* ---------- Self-check ---------- */

function correctSet(item: SelfCheck): Set<number> {
  return new Set(Array.isArray(item.answerIndex) ? item.answerIndex : [item.answerIndex]);
}

export function SelfCheckList({ items }: { items: SelfCheck[] }) {
  const [results, setResults] = useState<Record<number, boolean>>({});
  const answered = Object.keys(results).length;
  const correct = Object.values(results).filter(Boolean).length;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 text-sm">
        <p className="text-ink-2">Pick an answer to see the explanation. Answers aren&apos;t saved.</p>
        {answered > 0 ? (
          <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold tabular-nums">
            {correct}/{answered} correct
          </span>
        ) : null}
      </div>
      <ol className="space-y-4">
        {items.map((item, i) => (
          <SelfCheckItem
            key={i}
            item={item}
            number={i + 1}
            onResult={(ok) =>
              setResults((prev) => {
                const next = { ...prev };
                if (ok === null) delete next[i];
                else next[i] = ok;
                return next;
              })
            }
          />
        ))}
      </ol>
    </div>
  );
}

const LETTERS = ["A", "B", "C", "D"];

function SelfCheckItem({ item, number, onResult }: { item: SelfCheck; number: number; onResult: (correct: boolean | null) => void }) {
  const name = useId();
  const answers = correctSet(item);
  const multi = Array.isArray(item.answerIndex);
  const [selected, setSelected] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const isCorrect = revealed && selected.length === answers.size && selected.every((i) => answers.has(i));

  function reveal(choice: number[]) {
    setRevealed(true);
    onResult(choice.length === answers.size && choice.every((i) => answers.has(i)));
  }

  function choose(index: number) {
    if (revealed) return;
    if (!multi) {
      setSelected([index]);
      reveal([index]);
      return;
    }
    setSelected((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  }

  function reset() {
    setSelected([]);
    setRevealed(false);
    onResult(null);
  }

  return (
    <li className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <fieldset>
        <legend className="flex gap-3 font-medium text-pretty">
          <span className="font-display text-ink-3 tabular-nums">{number}.</span>
          <span>
            {item.question}
            {multi ? <span className="ml-2 inline-block rounded-md bg-warn-soft px-1.5 py-0.5 align-middle text-[11px] font-semibold text-warn uppercase">Select {answers.size}</span> : null}
          </span>
        </legend>
        <div className="mt-4 space-y-2" role={multi ? "group" : "radiogroup"}>
          {item.options.map((option, index) => {
            const chosen = selected.includes(index);
            const right = answers.has(index);
            const state = !revealed ? (chosen ? "chosen" : "idle") : right ? "right" : chosen ? "wrong" : "muted";
            return (
              <label
                key={index}
                className={cx(
                  "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors",
                  !revealed && "cursor-pointer hover:border-line-strong hover:bg-surface-2/60",
                  state === "idle" && "border-line",
                  state === "chosen" && "border-accent bg-accent-soft/50",
                  state === "right" && "border-good/50 bg-good-soft",
                  state === "wrong" && "border-bad/50 bg-bad-soft",
                  state === "muted" && "border-line opacity-60",
                )}
              >
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={name}
                  className="sr-only"
                  checked={chosen}
                  disabled={revealed}
                  onChange={() => choose(index)}
                />
                <span
                  aria-hidden="true"
                  className={cx(
                    "flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                    state === "right" ? "bg-good text-white" : state === "wrong" ? "bg-bad text-white" : state === "chosen" ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2",
                  )}
                >
                  {state === "right" ? <CheckIcon className="size-3.5" strokeWidth={3} /> : state === "wrong" ? <XIcon className="size-3.5" strokeWidth={3} /> : LETTERS[index]}
                </span>
                <span className="pt-0.5 leading-relaxed">
                  {option}
                  {revealed && right ? <span className="sr-only"> (correct answer)</span> : null}
                  {revealed && chosen && !right ? <span className="sr-only"> (your answer, incorrect)</span> : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {multi && !revealed ? (
        <button type="button" className={cx(buttonStyles.secondary, "mt-3 py-2")} disabled={selected.length !== answers.size} onClick={() => reveal(selected)}>
          Check answer ({selected.length}/{answers.size})
        </button>
      ) : null}
      {revealed ? (
        <div className="mt-4 rounded-xl bg-surface-2/70 p-4" role="status">
          <p className={cx("flex items-center gap-2 text-sm font-semibold", isCorrect ? "text-good" : "text-bad")}>
            {isCorrect ? <CheckIcon className="size-4" /> : <XIcon className="size-4" />}
            {isCorrect ? "Correct" : "Not quite"}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{item.explanation}</p>
          <button type="button" className={cx(buttonStyles.ghost, "mt-2 -ml-2.5")} onClick={reset}>
            Try again
          </button>
        </div>
      ) : null}
    </li>
  );
}

/* ---------- Confidence ---------- */

const CONFIDENCE_LABELS = ["Lost", "Shaky", "Okay", "Solid", "Nailed it"];

export function ConfidencePicker({ day }: { day: number }) {
  const { view, sync } = useProgress();
  const value = view?.days[String(day)]?.confidence ?? null;
  const name = useId();
  return (
    <div>
      <div role="radiogroup" aria-label="Confidence from 1 to 5" className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <label
              key={n}
              className={cx(
                "flex cursor-pointer flex-col items-center gap-1 rounded-xl border py-2.5 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent",
                active ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface hover:border-line-strong hover:bg-surface-2",
                !view && "cursor-wait opacity-50",
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={active}
                disabled={!view}
                onChange={() => sync.dispatch([{ type: "setConfidence", day, value: n }])}
              />
              <span className="font-display text-lg leading-none font-semibold">{n}</span>
              <span className={cx("text-[10px] font-medium", active ? "text-accent-ink/80" : "text-ink-3")}>{CONFIDENCE_LABELS[n - 1]}</span>
            </label>
          );
        })}
      </div>
      {value !== null ? (
        <button type="button" className={cx(buttonStyles.ghost, "mt-2 -ml-2.5 text-xs")} onClick={() => sync.dispatch([{ type: "setConfidence", day, value: null }])}>
          Clear rating
        </button>
      ) : null}
    </div>
  );
}

/* ---------- Notes ---------- */

const AUTOSAVE_MS = 800;

/**
 * Keeps a local draft while you type, autosaves ~800 ms after typing stops, and flushes on blur
 * and on pagehide. A refetch never overwrites the draft: it only shows once you leave the field.
 */
export function NotesEditor({ day }: { day: number }) {
  const { view, sync } = useProgress();
  const saved = view?.days[String(day)]?.notes ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const value = draft ?? saved;

  function commit(): void {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const text = draftRef.current;
    const current = sync.getState().view?.days[String(day)]?.notes ?? "";
    if (text !== null && text !== current) sync.dispatch([{ type: "setNotes", day, notes: text }]);
  }

  useEffect(() => {
    const onPageHide = () => {
      if (timer.current === null || draftRef.current === null) return;
      clearTimeout(timer.current);
      timer.current = null;
      sync.sendOnExit([{ type: "setNotes", day, notes: draftRef.current }]);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      // Leaving the page by client navigation: save what's pending.
      if (timer.current !== null && draftRef.current !== null) {
        clearTimeout(timer.current);
        sync.dispatch([{ type: "setNotes", day, notes: draftRef.current }]);
      }
    };
  }, [day, sync]);

  return (
    <div>
      <textarea
        value={value}
        disabled={!view}
        maxLength={NOTES_MAX_LENGTH}
        onChange={(e) => {
          draftRef.current = e.target.value;
          setDraft(e.target.value);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(commit, AUTOSAVE_MS);
        }}
        onBlur={() => {
          commit();
          draftRef.current = null;
          setDraft(null);
        }}
        rows={7}
        placeholder={view ? "What clicked today? What's still fuzzy? Anything to revisit…" : "Loading…"}
        aria-label={`Notes for day ${day}`}
        className="block w-full resize-y rounded-xl border border-line bg-surface-2/40 px-3.5 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:ring-4 focus:ring-ring focus:outline-none disabled:cursor-wait disabled:opacity-60"
      />
      <p className="mt-1.5 text-right text-[11px] text-ink-3">{draft !== null ? "Autosaves as you type" : "Saved with your progress"}</p>
    </div>
  );
}
