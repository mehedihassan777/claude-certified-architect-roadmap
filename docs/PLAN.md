# Implementation plan

Status: **approved 2026-09-28**, with all four decisions in §6 accepted. Stages (a) and (b) were approved and pushed 2026-09-28. On 2026-09-29 the user replaced the JSON-file storage with Supabase and added accounts and an admin (§7); that change is built and awaiting review. Brief: [SPEC.md](SPEC.md). Research log: [RESEARCH.md](RESEARCH.md).

## 1. What Step 0 changed

Checked against the exam guide PDF and the certification FAQ (links in RESEARCH.md).

- **Exam:** 60 items in 120 min, 4 scenarios drawn from a bank of 6, pass mark is a scaled 720 (on 100–1,000). Items are **multiple-choice and multiple-response**: "each item states how many responses to select".
- **Domains:** Agentic Architecture & Orchestration 27% · Tool Design & MCP Integration 18% · Claude Code Configuration & Workflows 20% · Prompt Engineering & Structured Output 20% · Context Management & Reliability 15%.
- **Eligibility:** "Certification is currently available only to organizations in the Claude Partner Network." Registration needs a partner email on a recognized company domain (personal addresses don't work). Candidates must be 18+.
- **Practice exam:** the official one was retired in the move to Pearson VUE. The mock days use the guide's 12 sample questions and community mocks, labelled as community.
- **MCP:** the current spec (2026-07-28) is stateless, with no `initialize` handshake. Day 18 teaches the current spec and points out what the exam guide may assume from older revisions.
- **Coverage:** all 30 task statements in the guide fit onto the brief's days. The titles in §5 add them without moving any day.

## 2. Toolchain (npm registry and nodejs.org, 2026-09-28)

| Package | Version | Why |
|---|---|---|
| next | 16.3.6 (latest) | `proxy.ts` replaces `middleware.ts` |
| react, react-dom | 19.2.8 | the exact pin in Next 16.3.6's own template (19.3 is out, but Next pins 19.2.x) |
| typescript | 6.0.x, **not 7.0** | typescript-eslint 8.70 (used by eslint-config-next) requires TS < 6.1 |
| eslint | 9.39, **not 10** | eslint-plugin-react, -import and -jsx-a11y (inside eslint-config-next) stop at ESLint 9. npm flags 9.x as out of support, but Next 16.3.6's template still pins `^9` |
| tailwindcss | 4.3 | CSS-first config |
| zod | 4.6 | |
| vitest | 4.1, **not 5.0** | Vitest 5 supports Node 22, 24 and ≥26, but not 25 |
| tsx | 4.x | runs `scripts/content-check.ts` |

- **Node:** this machine has v25.0.0, which reached end-of-life on 2026-06-01. Every package above runs on it, but Node 24 LTS is recommended, and the Docker image will use `node:24-alpine`. Node 26 becomes LTS on 2026-10-28.
- **Docker:** not installed here, so in stage (d) the Dockerfile can be written but not built on this machine.

## 3. Architecture

**Shape.** One Next.js App Router app. Pages are server components that render study content from the bundled JSON. A client `ProgressProvider` loads progress in the browser, so pages stay static and all date logic runs in the browser's time zone.

**Content.** `content/week-N.json` is imported at build time and parsed with Zod when the module loads, so an invalid file fails `next build` and `npm test`. The cross-file rules in §4 live in one function, shared by the tests and `npm run content:check`. The browser receives only a small index (task IDs, days, domains, minutes), not the full text.

**Progress core.** `applyOperation(progress, op, ctx)` is pure and runs on both sides: the API applies it to the stored document, and the browser applies the same function for optimistic updates. `ctx` carries the valid task IDs and `now`. When an operation changes nothing, it returns the same object and nothing is written.

**Service.** `updateProgress(ops)` reads, applies every op, then calls `write(next, version)`. On a `VersionConflictError` it re-reads and re-applies, up to 3 retries, then responds 409. One PATCH means one write, which is one commit on the github driver.

**Stores** (`STORAGE_DRIVER`):
- `file`: the version is the SHA-256 of the file bytes. A missing file is created as an empty document.
  - **Writes:** each write runs under an in-process promise lock (held on `globalThis` so dev reloads share it). It checks the version, writes a temp file in the same directory, fsyncs it and renames it over the original. On Windows it retries the rename briefly on EPERM/EBUSY.
  - **Invalid file:** a file that fails validation is never overwritten. The API returns an error, and you fix the file or import a backup.
  - **Limit:** one app instance per file.
- `github`: uses the GitHub Contents API on a separate private repo.
  - **Versioning:** the version is the blob sha. A 404 creates the file, and a 409 on PUT becomes a `VersionConflictError`.
  - **Requests:** `cache: "no-store"` and a 10 s timeout. `fetch` is injected so tests can mock it.
  - **Commits:** messages summarize the operations, for example `progress: d07-t3 done`.

**API.** Route handlers run on the Node runtime with `force-dynamic` and `Cache-Control: no-store`. Each handler re-checks the session. Mutating calls also require a same-origin `Origin` header.

| Route | Body | Returns |
|---|---|---|
| `GET /api/progress` | none | `{ progress, version }` |
| `PATCH /api/progress` | `{ ops: Operation[] }` (1–50) | `{ progress, version }`. 400 bad body · 422 unknown task/day · 409 still conflicting |
| `GET /api/progress/export` | none | `progress.json` download |
| `POST /api/progress/import` | full progress document | `{ progress, version, orphans }` |

Import is strict about shape. Well-formed task IDs that aren't in the content are kept and reported as `orphans`, not dropped, so an old export still imports after content edits. Reset is an import of an empty document, behind a typed confirmation.

**Browser state.** `ProgressProvider` keeps the last server snapshot plus any in-flight and queued ops. What you see is the snapshot with those ops applied.
- **Saving:** one PATCH is in flight at a time, so order is preserved, and ops queued meanwhile go out together in the next PATCH. On failure the ops roll back and the header shows **Failed – Retry**; otherwise it shows **Saving… / Saved**.
- **Refetch:** on window focus, `visibilitychange` and `online`.
- **Notes:** kept as a local draft, autosaved about 800 ms after typing stops, and flushed on blur and on `pagehide` (keepalive fetch). A refetch never overwrites a draft you're typing.

**Dates.** The server writes UTC ISO timestamps only, and `startDate` is a plain calendar date. The browser turns timestamps into local dates with `Intl.DateTimeFormat`. The stats functions take the time zone as an argument, so the tests can cover DST changes and UTC+14.

**Dashboard rules** (pure functions in `stats.ts`):
- **Progress %** (overall, per week, per domain) is done tasks ÷ tasks. **Hours** are task minutes done vs. remaining.
- **Today** is the first day that has an incomplete task.
- **Ahead/behind:** Day *k* is due by the end of startDate + (k − 1). Let N = whole days since startDate (capped at 42) and D = fully completed days.
  - D < N: behind by N − D.
  - D > N + 1: ahead by D − N − 1.
  - Otherwise: on track. Finishing today's day reads "on track", not "ahead".
- **Streak:** consecutive local dates with at least one completion, counted back from today (or from yesterday if nothing is done yet today).
- **Weakest domains:** lowest average confidence over rated days, excluding exam-practice.

**Auth** (stage d).
- **Login:** `/login` checks `APP_PASSCODE` with a constant-time compare and throttles failed attempts in memory. It then sets a 30-day cookie holding an expiry signed with HMAC-SHA256 (Web Crypto, keyed by `SESSION_SECRET`). The cookie is httpOnly, SameSite=Lax, and Secure in production.
- **Proxy:** `proxy.ts` lets through only `/login` and static assets. Other pages redirect to `/login?next=…` (relative paths only), and API calls get a 401 JSON response.
- **Env:** validated with Zod and checked at boot in `instrumentation.ts`.

**UI** (stage b). Tailwind v4, mobile-first, and a light/dark/system theme set before first paint. Self-check options are a radio group (checkboxes for "select N" items), and the right answer and explanation appear once you answer.

**Deployment** (stage d). A standalone build on `node:24-alpine`, running as a non-root user, with `./data` mounted at `/app/data`. On Vercel or Netlify, use the github driver with a fine-grained PAT scoped to the progress repo (Contents: read and write).

**Tests** (Vitest, node environment):
- **applyOperation:** every op, idempotency, validation errors, immutability, no-op detection.
- **service:** re-read and re-apply on conflict, giving up after 3 retries.
- **FileStore** (temp dir): first read creates the file, a stale version conflicts, 50 concurrent updates all persist, no temp files are left behind, and an invalid file is never overwritten.
- **GitHubStore** (mocked fetch): 404 creates the file, base64 round-trips, the sha is sent on PUT, and a 409 conflict is retried successfully.
- **Route handlers:** run against a FileStore in a temp dir.
- **Content integrity:** the rules in §4.
- **Stage b:** stats (time zones, DST).
- **Stage d:** session signing.

### File tree

Letters mark the stage that creates each file; stage (a) entries match what was built. Tests sit next to the code they test.

```
├── CLAUDE.md · AGENTS.md · README.md (d) · .env.example (a, d) · .nvmrc · package.json
├── next.config.ts · tsconfig.json · eslint.config.mjs · postcss.config.mjs · vitest.config.mts
├── Dockerfile · .dockerignore · docker-compose.yml             (d)
├── docs/        SPEC.md · RESEARCH.md · PLAN.md
├── content/     week-1.json … week-6.json · sources.json       (placeholders a, real c)
├── data/        progress.json at runtime (gitignored)
├── scripts/     content-check.ts                               (a)
└── src/
    ├── proxy.ts                          auth gate (d)
    ├── instrumentation.ts                storage settings checked at boot (a)
    ├── app/
    │   ├── layout.tsx · globals.css      shell (a); nav, theme, ProgressProvider (b)
    │   ├── page.tsx                      placeholder list of days (a); dashboard (b)
    │   ├── roadmap/page.tsx              (b)
    │   ├── day/[n]/page.tsx              static params 1–42 (b)
    │   ├── settings/page.tsx             (b)
    │   ├── login/page.tsx · actions.ts   (d)
    │   └── api/progress/
    │       ├── route.ts · route.test.ts  GET, PATCH; the test covers all three routes (a)
    │       ├── export/route.ts           GET (a)
    │       └── import/route.ts           POST (a)
    ├── components/                       TaskItem, SelfCheck, NotesEditor, ConfidencePicker, SaveStatus… (b)
    ├── client/
    │   ├── progress-provider.tsx         optimistic store, save state, refetch on focus (b)
    │   └── api-client.ts                 (b)
    └── lib/
        ├── env.ts · env.test.ts          storage settings (a); auth settings (d)
        ├── dates.ts                      local-date helpers (b)
        ├── api/       http.ts            handler wrapper, error → status mapping, same-origin check (a)
        ├── content/   domains · rules · schema · integrity · validate · index (app) · load (disk) · content.test (a)
        ├── progress/  schema · apply · service · server · *.test (a) · stats (b)
        ├── storage/   types · codec · lock · file-store · github-store · index · *.test (a)
        └── auth/      session.ts · session.test.ts   (d)
```

- `domains.ts` holds the domain labels, exam weights and the 30 task statements. `rules.ts` holds the numeric content rules.
- `content/index.ts` imports the JSON for the app, and `load.ts` reads the same files from disk for the tests and `content:check`. Both go through `validate.ts`.
- `storage/codec.ts` writes stable JSON (fixed key order, tasks sorted) and parses stored bytes; a BOM is fine.

**Stage (d) note:** the same-origin check compares `Origin` with `X-Forwarded-Host` or `Host`, like Next's own Server Actions check. Behind a reverse proxy, the proxy must forward the public host (`proxy_set_header Host $host;` in nginx). The README needs to say so.

## 4. Schemas

### Content (`src/lib/content/schema.ts`)

```ts
export const DOMAINS = ["foundations", "agentic-architecture", "tool-design-mcp", "claude-code",
  "prompt-engineering", "context-management", "exam-practice"] as const;
export const TASK_TYPES = ["recall", "study", "hands-on", "practice", "revise", "quiz"] as const;

export const DayNumber = z.number().int().min(1).max(42);
export const TaskId = z.string().regex(/^d(0[1-9]|[1-3]\d|4[0-2])-t[1-9]\d*$/);   // d07-t3

const Resource = z.strictObject({
  title: z.string().min(1),            // community links end "(community, not affiliated with Anthropic)"
  url: z.url({ protocol: /^https$/ }),
});

const Task = z.strictObject({
  id: TaskId,
  type: z.enum(TASK_TYPES),
  title: z.string().min(1),
  details: z.string().min(1),
  estMinutes: z.number().int().min(5).max(180),
  resources: z.array(Resource),
});

const SelfCheck = z.strictObject({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  answerIndex: z.number().int().min(0).max(3),        // decision 1: also allow number[] ("select 2")
  explanation: z.string().min(1),
});

export const Day = z.strictObject({
  day: DayNumber,
  week: z.number().int().min(1).max(6),
  title: z.string().min(1),
  domain: z.enum(DOMAINS),
  estMinutes: z.number().int().positive(),            // must equal the sum of its tasks
  objectives: z.array(z.string().min(1)).min(1),
  keyPoints: z.array(z.string().min(1)).min(4).max(6),
  connectToExperience: z.string().min(1).optional(),
  taskStatements: z.array(z.string().regex(/^[1-5]\.[1-7]$/)).optional(),   // decision 2
  tasks: z.array(Task).min(3).max(5),
  selfCheck: z.array(SelfCheck).min(3).max(10),
});

export const Week = z.strictObject({
  week: z.number().int().min(1).max(6),
  title: z.string().min(1),
  days: z.array(Day).length(7),
});
```

Integrity rules (`integrity.ts`, run by `npm test` and `content:check`):
- `week-N.json` has `week: N` and days 7N−6 … 7N in order, so days 1–42 each appear exactly once.
- Task IDs are unique across all weeks, and each ID's `dNN` matches its day.
- `day.estMinutes` equals the sum of its tasks' `estMinutes`.
- Days 2–42 start with a 10-minute `recall` task, and every day ends with a `quiz` task.
- `selfCheck` has 3–5 questions per day and exactly 10 on review days (7, 14, 21, 28, 35, 42). Options are distinct.
- Every resource URL is listed in `content/sources.json` (decision 3), and community hosts carry the label.
- Each of the 30 task statements (1.1–5.6) is covered by at least one day (decision 2).

### Progress (`src/lib/progress/schema.ts`)

```ts
const IsoDate = z.iso.date();            // "2026-10-01": a calendar date, no time zone
const UtcTimestamp = z.iso.datetime();   // "2026-10-01T14:03:11.123Z": Z only, offsets rejected

const TaskProgress = z.strictObject({
  done: z.boolean(),
  completedAt: UtcTimestamp.nullable(),
}).refine((t) => t.done === (t.completedAt !== null), "completedAt is set exactly when done");

const DayProgress = z.strictObject({
  notes: z.string().max(20_000),
  confidence: z.number().int().min(1).max(5).nullable(),   // null = not rated yet
});

export const Progress = z.strictObject({
  schemaVersion: z.literal(1),
  startDate: IsoDate.nullable(),
  updatedAt: UtcTimestamp,
  tasks: z.record(TaskId, TaskProgress),
  days: z.record(z.string().regex(/^([1-9]|[1-3]\d|4[0-2])$/), DayProgress),
});

export const Operation = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("setTask"), taskId: TaskId, done: z.boolean() }),
  z.strictObject({ type: z.literal("setNotes"), day: DayNumber, notes: z.string().max(20_000) }),
  z.strictObject({ type: z.literal("setConfidence"), day: DayNumber,
                   value: z.number().int().min(1).max(5).nullable() }),
  z.strictObject({ type: z.literal("setStartDate"), date: IsoDate.nullable() }),
]);

export interface ProgressStore {
  read(): Promise<{ data: Progress; version: string }>;
  write(data: Progress, expectedVersion: string): Promise<{ version: string }>; // throws VersionConflictError
}
```

Semantics:
- `setTask` with `done: true` keeps an existing `completedAt`, so re-applying the same op doesn't move it. With `done: false` it stores `{ done: false, completedAt: null }`.
- An unknown `taskId` returns 422. `setNotes` and `setConfidence` create the day entry the first time they're used.
- `updatedAt` changes only when something actually changed.

## 5. The 42 days

Additions drawn from the exam guide are marked **+**. Numbers in brackets are task statements.

**Week 1: Foundations** (not an exam domain; domain `foundations`)
1. Orientation: exam guide, Console and API key with a spend limit, cca-labs setup, sample questions
2. How LLMs work: tokens, context window, next-token prediction, sampling and temperature, hallucinations
3. Claude models and model selection: capability vs latency vs cost; pricing and rate limits (linked, never hardcoded)
4. Messages API: roles, system prompt, max_tokens, stop_reason, stop sequences; first TypeScript SDK call. **+** statelessness: you resend the history [5.1]
5. Streaming, error types, retries with backoff, token counting. **+** Message Batches API [4.5]
6. Image and PDF inputs; reliable structured JSON output. **+** schema design: nullable fields, "other" + detail enums [4.3]
7. Week 1 review

**Week 2: Prompt Engineering & Structured Output** (`prompt-engineering`)

8. Clear and direct prompts: context, task, success criteria. **+** explicit criteria vs vague instructions [4.1]
9. System prompts, role prompting, XML tags
10. Few-shot examples and output formatting [4.2]
11. Chain of thought and extended thinking: when they help and when they don't
12. Prompt chaining, long-context prompting, reducing hallucinations. **+** validation–retry loops [4.4]
13. Evals: test sets, code- vs model-graded; hands-on: evaluate an OMS ticket classifier. **+** human review and confidence calibration [5.5]
14. Week 2 review

**Week 3: Tool Design & MCP Integration** (`tool-design-mcp`)

15. Tool use: JSON Schema tool definitions; the tool_use → tool_result loop. **+** loop control by stop_reason [1.1]
16. tool_choice, parallel tool calls, returning errors to the model; hands-on: a two-tool agent loop [2.3, 4.3]
17. Tool design: names and descriptions as prompts, granularity, input validation, concise results, pagination. **+** structured error metadata [2.1, 2.2]
18. MCP architecture: host/client/server; tools, resources, prompts; stdio vs Streamable HTTP; lifecycle and capabilities [2.4]
19. Hands-on: OMS MCP server (get_order, list_orders_by_status, get_stock_by_warehouse), tested in MCP Inspector [2.2]
20. MCP security and operations; connect the server to Claude Code; optional C# SDK port [2.4]
21. Week 3 review

**Week 4: Claude Code Configuration & Workflows** (`claude-code`)

22. How Claude Code works: agentic loop, built-in tools, permission modes, plan mode vs direct execution [2.5, 3.4]
23. CLAUDE.md hierarchy and @imports; `.claude/rules/` path-specific rules; settings and permission rules [3.1, 3.3]
24. Custom slash commands and skills. **+** iterative refinement techniques [3.2, 3.5]
25. Hooks: lifecycle events and practical uses. **+** hooks as deterministic enforcement [1.4]
26. Subagents (including Explore); MCP server configuration scopes [2.4, 3.4]
27. Headless mode and CI; hands-on: give cca-labs a CLAUDE.md, a rule, a hook, a command and a subagent. **+** independent review instances [3.6, 4.6]
28. Week 4 review

**Week 5: Agentic Architecture & Orchestration** (`agentic-architecture`)

29. What makes a system agentic; agents vs workflows vs conversational systems; when simpler patterns win [1.1]
30. Workflow patterns: chaining, routing, parallelization, orchestrator–workers, evaluator–optimizer
31. Task decomposition, sequential vs parallel, dynamic planning and replanning, ambiguity. **+** multi-pass review [1.6, 4.6]
32. Claude Agent SDK fundamentals; hands-on: Order Investigator agent on your MCP server. **+** SDK hooks [1.5]
33. Multi-agent systems: orchestrator–subagent, context isolation and passing, topologies, handoffs; hands-on: add a subagent [1.2, 1.3, 2.3]
34. Reliability and safety: failure modes, retries, idempotent actions, guardrails, human-in-the-loop, stopping conditions, observability, cost. **+** escalation, error propagation [1.4, 5.2, 5.3]
35. Week 5 review

**Week 6: Context Management & Reliability, then exam practice** (36–38 `context-management`, 39–42 `exam-practice`)

36. Context as a budget: what fills it, quality loss in long contexts, choosing what to include. **+** case-facts blocks, provenance [5.1, 5.6]
37. Prompt caching: cached prefixes, cache lifetime, cost impact, cache-friendly structure; hands-on: measure cache hits
38. Long-running agents: compaction, external memory, retrieval basics, what a subagent gets vs what the orchestrator keeps. **+** session resume and fork, large-codebase exploration [1.7, 5.4]
39. Full timed mock #1 (120 min) and a wrong-answer log
40. Targeted revision of your two weakest domains
41. Full timed mock #2 (a different question set) and review
42. Final review (light day): one-page cheat sheet, exam-day rules

**Hands-on thread (cca-labs).** The mock OMS data is heterogeneous on purpose: Unix and ISO timestamps, numeric status codes, and two look-alike lookup tools. That lets the guide's four preparation exercises happen inside the project:
- **Exercise 1**, multi-tool agent with escalation: Days 16, 17, 19, 32 and 34.
- **Exercise 2**, Claude Code team setup: Days 20 and 23–27.
- **Exercise 3**, extraction pipeline with batches: Days 5, 6, 12 and 13.
- **Exercise 4**, multi-agent pipeline with provenance: Day 33.

Mock days run about 150 minutes. Every other day aims for 60–120.

## 6. Decisions (all approved 2026-09-28)

1. **Multiple-response self-checks.** The real exam has "select N" items, but the brief's schema allows only one answer. Proposal: `answerIndex: number | number[]`, where an array means "select all N". Use them on some days, plus 2 per review day. *Default: yes.*
2. **`taskStatements` per day** (optional), shown as chips on the day page, plus a test that all 30 are covered. *Default: yes.*
3. **`content/sources.json`.** Every resource URL is listed there with the date it was opened, and the content test fails on any URL that isn't. This turns the "only pages I opened" rule into a check. *Default: yes.*
4. **Git.** This folder isn't a repo yet. Run `git init` in stage (a), and commit at the end of each stage you approve? *Default: init yes, commit only when you say so.*

**Heads-up.** Stages (a) and (b) need 42 valid days before stage (c) exists, so they use generated, schema-valid placeholder content with the titles above. Their task IDs are replaced in stage (c), and the stable-ID rule applies from then on. Don't record real progress until stage (c) lands.

## 7. Change: Supabase, accounts and an admin (2026-09-29)

Requested after deploying to Vercel, where the file driver can't write. This replaces "no database" and "single user" from the brief. Decisions (user, 2026-09-29):

- **Users:** anyone can register and gets separate progress. One admin account.
- **Auth:** Supabase Auth, email + password, verified server-side with `getClaims()`. Sessions live in cookies set by `@supabase/ssr`; `proxy.ts` refreshes them and gates pages (redirect to `/login?next=…`) and `/api/*` (401). Layouts, handlers and server actions check again.
- **Storage:** one row per user in `public.progress` holding the same progress JSON document (jsonb) plus an integer version. `applyOperation`, the conflict retry, import, export and reset are unchanged.
- **Drivers:** the file and github drivers are removed; Supabase only. Local dev uses a Supabase project (or the Supabase CLI).
- **Admin:** `ADMIN_USER_ID` (a user UUID, not an email, so nobody can claim admin by registering an address first). `/admin` lists accounts with progress, last activity and sign-in, and can delete an account (its row cascades). It uses the secret key server-side only. New sign-ups are switched off in the Supabase dashboard, not in the app.
- **Email confirmation:** `/auth/confirm` accepts both the default `?code=` link and a `?token_hash=&type=` template.
- **Security:** RLS limits every progress query to the caller's row; the migration revokes table grants from `anon` and grants only select/insert/update to `authenticated`. `?next=` accepts relative paths only.
- **Stage (d)** keeps deployment files and the README; its auth work is done here.

