# CCA-F Roadmap

Self-hosted Next.js tracker for a 42-day study plan for the Claude Certified Architect – Foundations exam. Single user, no database: progress is one JSON file.

- Brief: `docs/SPEC.md`. Approved plan, schemas and stage status: `docs/PLAN.md`. Verified exam facts, task-statement map and opened sources: `docs/RESEARCH.md`.
- Next.js 16 agent rules: @AGENTS.md. The docs for the installed version are in `node_modules/next/dist/docs/`.

## Workflow
Stages: (a) scaffold, storage, API, tests → (b) UI → (c) content, one week at a time, each checked against its sources → (d) auth, deployment, README. Stop after each stage for the user's review, and commit only once they approve it. Until stage (c), `content/` holds generated placeholder weeks.

## Commands
- `npm run dev` / `npm run build` / `npm start`
- `npm run lint`, `npm run typecheck` (runs `next typegen`, then `tsc`), `npm test`: all three must pass before any stage is called done
- `npm run content:check`: validate `content/*.json` (schema and integrity rules). The test suite runs the same checks.

## Where things live
- `src/lib/content/`: the schema, integrity rules, and loaders. `index.ts` loads content for the app and `load.ts` reads it from disk for the tests and `content:check`.
- `src/lib/progress/`: the progress schema, the pure `apply.ts`, and `service.ts` (the read → apply → write cycle with conflict retry).
- `src/lib/storage/`: `FileStore`, `GitHubStore` and `getStore()`.
- `src/lib/api/http.ts`: the route-handler wrapper, the error → status mapping and the same-origin check.

## Rules that must not break
- **Task IDs are stable**: `dNN-tM` (e.g. `d07-t3`). Never renumber, reuse or edit an existing ID. A new task takes the next unused `tM` for its day. Saved progress is keyed by these IDs. The rule applies from stage (c).
- **All progress changes go through the pure `applyOperation()`**. Operations set values; they never toggle, so re-applying one is harmless.
- **Content is read-only JSON** (`content/week-1.json` … `week-6.json`), validated with Zod.
- **Sources**:
  - Every resource URL must be a page that was actually opened and checked, and must be listed in `content/sources.json` with the date it was checked. The content check fails otherwise.
  - No hardcoded model names or prices; link the docs page instead.
  - Community links end with "(community, not affiliated with Anthropic)".
- **Time**: the server stores UTC timestamps. Dates, "today", streaks and ahead/behind are computed in the browser's local time zone.

## Content schema
- Week file: `{ week, title, days: Day[] }`
- Day: `day` 1–42, `week` 1–6, `title`, `domain`, `estMinutes`, `objectives[]`, `keyPoints[]` (4–6), `connectToExperience?`, `taskStatements?` (exam-guide IDs "1.1"–"5.6"), `tasks[]` (3–5), `selfCheck[]`
- Task: `id`, `type` (recall | study | hands-on | practice | revise | quiz), `title`, `details`, `estMinutes`, `resources[]` of `{ title, url }` (https only)
- SelfCheck: `question`, `options` (4), `answerIndex` (0–3, or an array of 2–3 distinct indexes for a "select N" item), `explanation`
- Domain: foundations | agentic-architecture | tool-design-mcp | claude-code | prompt-engineering | context-management | exam-practice
- Integrity rules:
  - Days 2–42 open with a 10-minute `recall` task, and every day ends with a `quiz` task.
  - `estMinutes` is the sum of the day's task minutes.
  - 3–5 self-checks per day. Review days 7, 14, 21, 28, 35 and 42 have exactly 10, at least 2 of them multi-response.
  - Every exam task statement is covered by at least one day.

## Progress
`{ schemaVersion: 1, startDate: "YYYY-MM-DD" | null, updatedAt, tasks: { [taskId]: { done, completedAt } }, days: { [day]: { notes, confidence: 1–5 | null } } }`

Operations (PATCH `/api/progress`, body `{ ops: [...] }`): `setTask { taskId, done }` · `setNotes { day, notes }` · `setConfidence { day, value }` · `setStartDate { date }`.

## Storage (`STORAGE_DRIVER`)
`ProgressStore`: `read() → { data, version }`, `write(data, expectedVersion)` throws `VersionConflictError`.
- `file` (default; VPS/Docker): `PROGRESS_FILE_PATH` (default `./data/progress.json`). The file is created on first read, writes take an in-process lock, and each write goes to a temp file that is renamed over the original.
- `github` (Vercel/Netlify): GitHub Contents API on a separate private repo (`GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_PROGRESS_PATH`). The file's sha is the version.
- On conflict: re-read, re-apply the same operations, retry up to 3 times.
- A stored file that fails validation is never overwritten by an operation. Only an explicit import replaces it.

## Conventions
- **Route handlers:**
  - They use the default Node runtime and never export `runtime`.
  - Cache Components stays off, so they aren't cached, and responses send `Cache-Control: no-store`.
  - Auth is checked in `proxy.ts` (Next 16's name for middleware) and again inside each API handler.
- **Types:** TypeScript strict, with Zod at every boundary (env, content, request bodies, stored JSON).
- **Toolchain pins (don't bump blindly):**
  - TypeScript `~6.0`: typescript-eslint, inside eslint-config-next, requires < 6.1.
  - ESLint 9: eslint-config-next's react, import and jsx-a11y plugins declare peers only up to ESLint 9.
  - Vitest 4.1: Vitest 5 doesn't support Node 25.
