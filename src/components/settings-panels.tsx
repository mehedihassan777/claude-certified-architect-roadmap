"use client";

import { useRef, useState, type ReactNode } from "react";
import { errorMessage, importProgress } from "@/client/api-client";
import { useProgress } from "@/client/progress-provider";
import { useNow } from "@/client/use-now";
import { browserTimeZone, formatDateKey, localDateKey } from "@/lib/dates";
import { emptyProgress, ProgressSchema, type Progress } from "@/lib/progress/schema";
import { AlertIcon, CalendarIcon, CheckIcon, DownloadIcon, TrashIcon, UploadIcon } from "./icons";
import { buttonStyles, Card, cx } from "./ui";

export function SettingsPanels() {
  return (
    <div className="space-y-5">
      <StartDatePanel />
      <BackupPanel />
      <ResetPanel />
    </div>
  );
}

function Panel({ icon, title, description, children, tone }: { icon: ReactNode; title: string; description: ReactNode; children: ReactNode; tone?: "danger" }) {
  return (
    <Card className={cx("p-5 sm:p-6", tone === "danger" && "border-bad/30")}>
      <div className="flex gap-4">
        <span className={cx("inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-lg", tone === "danger" ? "bg-bad-soft text-bad" : "bg-surface-2 text-ink-2")}>{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-ink-2">{description}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </Card>
  );
}

const inputStyles =
  "rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:ring-4 focus:ring-ring focus:outline-none disabled:opacity-50";

function StartDatePanel() {
  const { view, sync } = useProgress();
  const now = useNow();
  const [draft, setDraft] = useState<string | null>(null);
  const saved = view?.startDate ?? null;
  const value = draft ?? saved ?? "";
  const today = now === 0 ? null : localDateKey(new Date(now), browserTimeZone());

  function save(date: string | null) {
    sync.dispatch([{ type: "setStartDate", date }]);
    setDraft(null);
  }

  return (
    <Panel icon={<CalendarIcon />} title="Start date" description="Day 1 is due on this date, and each later day one calendar day after. Used for the ahead/behind pace.">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={value} disabled={!view} onChange={(e) => setDraft(e.target.value)} className={inputStyles} aria-label="Start date" />
        <button type="button" className={buttonStyles.primary} disabled={!view || !value || value === saved} onClick={() => save(value)}>
          Save
        </button>
        {today && saved !== today ? (
          <button type="button" className={buttonStyles.secondary} disabled={!view} onClick={() => save(today)}>
            Start today
          </button>
        ) : null}
        {saved ? (
          <button type="button" className={buttonStyles.ghost} onClick={() => save(null)}>
            Clear
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-ink-3">{saved ? `Currently ${formatDateKey(saved, { dateStyle: "full" })}.` : view ? "Not set." : "Loading…"}</p>
    </Panel>
  );
}

type ImportState =
  | { kind: "idle" }
  | { kind: "ready"; fileName: string; data: Progress }
  | { kind: "busy" }
  | { kind: "done"; orphans: string[] }
  | { kind: "error"; message: string };

function BackupPanel() {
  const { view, sync, inflight, queued } = useProgress();
  const fileInput = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({ kind: "idle" });
  const pending = inflight.length > 0 || queued.length > 0;

  async function pick(file: File) {
    try {
      const parsed = ProgressSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) {
        setState({ kind: "error", message: "That file isn't a valid progress export." });
        return;
      }
      setState({ kind: "ready", fileName: file.name, data: parsed.data });
    } catch {
      setState({ kind: "error", message: "That file isn't valid JSON." });
    }
  }

  async function confirmImport(data: Progress) {
    setState({ kind: "busy" });
    try {
      const result = await importProgress(data);
      sync.replace(result);
      setState({ kind: "done", orphans: result.orphans });
    } catch (error) {
      setState({ kind: "error", message: errorMessage(error) });
    }
  }

  return (
    <Panel icon={<DownloadIcon />} title="Backup" description="Export your progress as a JSON file, or restore one. Importing replaces everything that's saved now.">
      <div className="flex flex-wrap gap-2">
        <a href="/api/progress/export" download className={buttonStyles.secondary}>
          <DownloadIcon className="size-4" /> Export JSON
        </a>
        <button type="button" className={buttonStyles.secondary} disabled={!view || pending || state.kind === "busy"} onClick={() => fileInput.current?.click()}>
          <UploadIcon className="size-4" /> Import…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void pick(file);
          }}
        />
      </div>

      {state.kind === "ready" ? (
        <div className="mt-4 rounded-xl border border-warn/40 bg-warn-soft p-4 text-sm">
          <p className="font-medium text-ink">
            Replace your progress with <span className="font-mono text-xs">{state.fileName}</span>?
          </p>
          <p className="mt-1 text-ink-2">
            It has {Object.values(state.data.tasks).filter((t) => t.done).length} completed tasks and {Object.keys(state.data.days).length} days with notes or ratings.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={buttonStyles.primary} disabled={pending} onClick={() => void confirmImport(state.data)}>
              Replace progress
            </button>
            <button type="button" className={buttonStyles.ghost} onClick={() => setState({ kind: "idle" })}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {state.kind === "busy" ? <p className="mt-3 text-sm text-ink-2">Importing…</p> : null}
      {state.kind === "done" ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-good">
          <CheckIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Imported.
            {state.orphans.length > 0
              ? ` ${state.orphans.length} task ${state.orphans.length === 1 ? "ID isn't" : "IDs aren't"} in the current content and ${state.orphans.length === 1 ? "was" : "were"} kept as-is: ${state.orphans.slice(0, 5).join(", ")}${state.orphans.length > 5 ? "…" : ""}`
              : ""}
          </span>
        </p>
      ) : null}
      {state.kind === "error" ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-bad" role="alert">
          <AlertIcon className="mt-0.5 size-4 shrink-0" /> {state.message}
        </p>
      ) : null}
    </Panel>
  );
}

const RESET_WORD = "reset";

function ResetPanel() {
  const { view, sync, inflight, queued } = useProgress();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const pending = inflight.length > 0 || queued.length > 0;

  async function reset() {
    setBusy(true);
    setMessage(null);
    try {
      sync.replace(await importProgress(emptyProgress(new Date())));
      setTyped("");
      setMessage({ ok: true, text: "Progress reset." });
    } catch (error) {
      setMessage({ ok: false, text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      tone="danger"
      icon={<TrashIcon />}
      title="Reset progress"
      description="Clears every ticked task, note, rating and the start date on your account. Export a backup first, because this can't be undone."
    >
      <label className="block text-sm text-ink-2">
        Type <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs font-semibold text-ink">{RESET_WORD}</span> to confirm
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={typed} onChange={(e) => setTyped(e.target.value)} className={cx(inputStyles, "w-40")} autoComplete="off" spellCheck={false} disabled={!view} />
          <button type="button" className={buttonStyles.danger} disabled={!view || pending || busy || typed.trim().toLowerCase() !== RESET_WORD} onClick={() => void reset()}>
            {busy ? "Resetting…" : "Reset everything"}
          </button>
        </div>
      </label>
      {message ? (
        <p className={cx("mt-3 text-sm", message.ok ? "text-good" : "text-bad")} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      ) : null}
    </Panel>
  );
}
