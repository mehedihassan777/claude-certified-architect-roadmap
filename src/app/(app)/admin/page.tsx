import type { User } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeleteUserButton, LocalDateTime } from "@/components/admin-parts";
import { Card, cx, Eyebrow, ProgressBar } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { DAYS, TASK_IDS } from "@/lib/content";
import { EnvError } from "@/lib/env";
import { ProgressSchema, type Progress } from "@/lib/progress/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PROGRESS_TABLE } from "@/lib/storage/supabase-store";

export const metadata: Metadata = { title: "Admin" };

interface Member {
  id: string;
  email: string;
  confirmed: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  lastActivityAt: string | null;
  tasksDone: number;
  daysDone: number;
  startDate: string | null;
  corrupt: boolean;
}

const WEEK_MS = 7 * 86_400_000;

function summarize(user: User, row: { data: unknown; updated_at: string } | undefined): Member {
  const parsed = row ? ProgressSchema.safeParse(row.data) : null;
  const progress: Progress | null = parsed?.success ? parsed.data : null;
  const done = (id: string) => progress?.tasks[id]?.done === true;
  return {
    id: user.id,
    email: user.email ?? "(no email)",
    confirmed: Boolean(user.email_confirmed_at),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    lastActivityAt: row?.updated_at ?? null,
    tasksDone: [...TASK_IDS].filter(done).length,
    daysDone: DAYS.filter((day) => day.tasks.every((task) => done(task.id))).length,
    startDate: progress?.startDate ?? null,
    corrupt: Boolean(row && !progress),
  };
}

interface MemberList {
  members: Member[];
  /** Accounts with a progress change in the last 7 days. */
  activeCount: number;
  error: string | null;
}

async function loadMembers(): Promise<MemberList> {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (error) {
    if (error instanceof EnvError) return { members: [], activeCount: 0, error: `${error.message} Add it in your environment variables, then redeploy.` };
    throw error;
  }
  const [users, rows] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from(PROGRESS_TABLE).select("user_id, data, updated_at"),
  ]);
  if (users.error) return { members: [], activeCount: 0, error: users.error.message };
  if (rows.error) return { members: [], activeCount: 0, error: rows.error.message };
  const byUser = new Map((rows.data as Array<{ user_id: string; data: unknown; updated_at: string }>).map((row) => [row.user_id, row]));
  const members = users.data.users
    .map((user) => summarize(user, byUser.get(user.id)))
    .sort((a, b) => (b.lastActivityAt ?? b.createdAt).localeCompare(a.lastActivityAt ?? a.createdAt));
  const now = Date.now();
  const activeCount = members.filter((m) => m.lastActivityAt !== null && now - Date.parse(m.lastActivityAt) < WEEK_MS).length;
  return { members, activeCount, error: null };
}

export default async function AdminPage() {
  const me = await getCurrentUser();
  if (!me?.isAdmin) notFound();

  const { members, activeCount, error } = await loadMembers();
  const totalTasks = TASK_IDS.size;
  const average = members.length === 0 ? 0 : members.reduce((sum, m) => sum + m.tasksDone / totalTasks, 0) / members.length;

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Only you can see this page</Eyebrow>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Admin</h1>
        <p className="mt-1.5 text-ink-2">Everyone who has registered, and how far they&apos;ve got.</p>
      </div>

      {error ? (
        <Card className="border-bad/30 p-5 text-sm text-bad" role="alert">
          {error}
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Accounts" value={String(members.length)} />
        <Tile label="Confirmed email" value={String(members.filter((m) => m.confirmed).length)} />
        <Tile label="Active in the last 7 days" value={String(activeCount)} />
        <Tile label="Average progress" value={`${Math.round(average * 100)}%`} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line bg-surface-2/50 text-xs text-ink-3">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Account</th>
                <th scope="col" className="px-4 py-3 font-medium">Progress</th>
                <th scope="col" className="px-4 py-3 font-medium">Days done</th>
                <th scope="col" className="px-4 py-3 font-medium">Last activity</th>
                <th scope="col" className="px-4 py-3 font-medium">Joined</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {members.map((m) => {
                const pct = m.tasksDone / totalTasks;
                return (
                  <tr key={m.id} className="align-middle">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{m.email}</span>
                        {m.id === me.id ? <Badge className="bg-accent-soft text-accent-soft-ink">You</Badge> : null}
                        {!m.confirmed ? <Badge className="bg-warn-soft text-warn">Unconfirmed</Badge> : null}
                        {m.corrupt ? <Badge className="bg-bad-soft text-bad">Invalid data</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-3">
                        Last sign-in: <LocalDateTime iso={m.lastSignInAt} />
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <ProgressBar value={pct} label={`${m.email} progress`} className="w-28" />
                        <span className="text-xs text-ink-2 tabular-nums">{Math.round(pct * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-ink-2 tabular-nums">
                      {m.daysDone} / {DAYS.length}
                    </td>
                    <td className="px-4 py-3.5 text-ink-2">
                      <LocalDateTime iso={m.lastActivityAt} />
                    </td>
                    <td className="px-4 py-3.5 text-ink-2">
                      <LocalDateTime iso={m.createdAt} />
                    </td>
                    <td className="px-4 py-3.5 text-right">{m.id === me.id ? null : <DeleteUserButton userId={m.id} email={m.email} />}</td>
                  </tr>
                );
              })}
              {members.length === 0 && !error ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-2">
                    No accounts yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-ink-3">
        To stop new sign-ups, turn off &ldquo;Allow new users to sign up&rdquo; in Supabase → Authentication → Sign In / Providers. Existing accounts keep working.
      </p>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={cx("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase", className)}>{children}</span>;
}
