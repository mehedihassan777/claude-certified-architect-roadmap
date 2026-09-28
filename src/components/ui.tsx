import type { ComponentProps, ReactNode } from "react";
import type { Domain } from "@/lib/content/domains";
import { DOMAIN_INFO } from "@/lib/content/domains";
import type { TaskType } from "@/lib/content/schema";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("rounded-2xl border border-line bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-ink-3">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase", className)}>{children}</p>;
}

/** A single-series meter: 8px track, rounded fill, colored by `color` (a CSS color). */
export function ProgressBar({
  value,
  color = "var(--accent)",
  label,
  className,
  size = "md",
}: {
  value: number;
  color?: string;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cx("w-full overflow-hidden rounded-full bg-surface-3", size === "sm" ? "h-1.5" : "h-2", className)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color, minWidth: pct > 0 ? "0.375rem" : 0 }}
      />
    </div>
  );
}

export function ProgressRing({ value, size = 120, stroke = 10, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(value, 0), 1);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
          style={{ opacity: clamped === 0 ? 0 : 1 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function domainColor(domain: Domain): string {
  return `var(--domain-${domain})`;
}

export function DomainDot({ domain, className }: { domain: Domain; className?: string }) {
  return <span aria-hidden="true" className={cx("inline-block size-2 shrink-0 rounded-full", className)} style={{ backgroundColor: domainColor(domain) }} />;
}

/** Domain identity: a colored dot beside neutral text, so the name never depends on color. */
export function DomainChip({ domain, short = false, className }: { domain: Domain; short?: boolean; className?: string }) {
  const info = DOMAIN_INFO[domain];
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-2",
        className,
      )}
      title={info.label}
    >
      <DomainDot domain={domain} />
      <span className="truncate">{short ? shortDomainLabel(domain) : info.label}</span>
    </span>
  );
}

export function shortDomainLabel(domain: Domain): string {
  switch (domain) {
    case "agentic-architecture":
      return "Agentic Architecture";
    case "tool-design-mcp":
      return "Tools & MCP";
    case "claude-code":
      return "Claude Code";
    case "prompt-engineering":
      return "Prompt Engineering";
    case "context-management":
      return "Context & Reliability";
    default:
      return DOMAIN_INFO[domain].label;
  }
}

const TASK_TYPE_STYLE: Record<TaskType, { label: string; className: string }> = {
  recall: { label: "Recall", className: "bg-surface-2 text-ink-2" },
  study: { label: "Study", className: "bg-accent-soft text-accent-soft-ink" },
  "hands-on": { label: "Hands-on", className: "bg-good-soft text-good" },
  practice: { label: "Practice", className: "bg-warn-soft text-warn" },
  revise: { label: "Revise", className: "bg-surface-2 text-ink-2" },
  quiz: { label: "Quiz", className: "bg-surface-3 text-ink" },
};

export function TaskTypeBadge({ type }: { type: TaskType }) {
  const style = TASK_TYPE_STYLE[type];
  return (
    <span className={cx("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase", style.className)}>
      {style.label}
    </span>
  );
}

export const buttonStyles = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-bad px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
} as const;

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("skeleton", className)} />;
}
