# Build "CCA-F Roadmap": a day-by-day study tracker for the Claude Certified Architect – Foundations exam

## About me
Software Engineer, 4+ years: .NET 8/C#, Angular, Next.js/TypeScript, microservices, event-driven design, CQRS, Transactional Outbox, idempotent consumers, Redis, Elasticsearch, RabbitMQ, PostgreSQL (Citus), Docker. I use Claude Code daily and finished Anthropic's "Claude Code in Action" course, but I haven't built production apps on the Claude API, Agent SDK or MCP.

Assume zero prior knowledge of LLMs and Claude. Do not skip or shorten any topic because of my background: I want to start from the root and revise what I already know. Where a topic overlaps my experience, cover it fully anyway and add a short "Connect to what you know" note (e.g., tool-call retries ↔ my retry policies and idempotent consumers; prompt caching ↔ Redis caching and how it differs; subagent context isolation ↔ bounded contexts).

## Goal
A Next.js app I self-host and use from home and office: a 42-day roadmap (6 weeks, ~60–120 min/day) of study, hands-on, practice and revision tasks. I tick tasks off and progress syncs across devices. No database: progress lives in one JSON file. Days are a sequence, not fixed dates. If I miss a day nothing locks; just show whether I'm ahead or behind.

## Step 0: research before writing any content
Ground the curriculum in current official sources using web search/fetch:
- Official exam page and exam guide PDF: https://anthropic.skilljar.com/claude-certified-architect-foundations-access-request. Confirm domain names, weights, question count and duration. What I know so far (verify, don't trust): 5 domains (Agentic Architecture & Orchestration 27%, Tool Design & MCP, Claude Code, Prompt Engineering, Context Management), ~60 scenario-based questions in 120 min.
- docs.claude.com: Messages API, prompt engineering, tool use, prompt caching, context windows, extended thinking, Agent SDK, Claude Code
- modelcontextprotocol.io: architecture, spec, SDKs
- Anthropic's "Building effective agents" article, and Anthropic courses on anthropic.skilljar.com
- Community practice (not affiliated with Anthropic, so label it that way): https://claudecertificationguide.com
Rules: every resource link must be a URL you actually opened. If you can't verify a fact or link, leave it out. Don't hardcode model names or prices; link to the relevant docs page instead.

## Curriculum: expand each day into 3–5 tasks
- Every day starts with a 10-min Recall task: write the previous day's key points from memory, then check.
- Every day ends with 3–5 scenario-based multiple-choice self-check questions in the exam's style (10 on review days), each with an explanation.
- Hands-on tasks build ONE project in a separate practice repo, "cca-labs" (TypeScript): an "OMS Order Investigator", which is an MCP server over mock order/warehouse data, later driven by an agent. Keep each hands-on task finishable within the day.

Week 1: Foundations (the root; not an exam domain)
1. Orientation: read the official exam guide; set up Claude Console, API key and a spend limit; create cca-labs; skim ~10 sample questions to see the exam style
2. How LLMs work: tokens, context window, next-token prediction, sampling/temperature, why hallucinations happen
3. Claude model tiers and model selection: capability vs latency vs cost; pricing and rate limits
4. Messages API: roles, system prompt, max_tokens, stop_reason, stop sequences; first call with the TypeScript SDK
5. Streaming, error types, retries with backoff, token counting
6. Image/PDF inputs and getting reliable structured (JSON) output
7. Week 1 review

Week 2: Prompt Engineering
8. Clear and direct prompts: context, task, success criteria
9. System prompts, role prompting, XML tags
10. Few-shot examples and output formatting
11. Chain of thought and extended thinking: when they help and when they don't
12. Prompt chaining, long-context prompting, reducing hallucinations
13. Evals: test sets, code-graded vs model-graded; hands-on: evaluate a prompt that classifies OMS support tickets
14. Week 2 review

Week 3: Tool Design & MCP
15. Tool use: tool definitions with JSON Schema; the tool_use → tool_result loop
16. tool_choice, parallel tool calls, returning errors to the model; hands-on: a two-tool agent loop
17. Tool design: names and descriptions as prompts, granularity, input validation, concise high-signal results, pagination/truncation
18. MCP architecture: host/client/server; tools, resources, prompts; stdio vs Streamable HTTP; lifecycle and capabilities
19. Hands-on: MCP server over mock OMS data (get_order, list_orders_by_status, get_stock_by_warehouse), tested with MCP Inspector
20. MCP security and operations: least privilege, auth for remote servers, prompt injection through tool output, confirming destructive actions; connect the server to Claude Code. Optional: port it to the official C# SDK
21. Week 3 review

Week 4: Claude Code
22. How Claude Code works: agentic loop, built-in tools, permission modes, plan mode
23. CLAUDE.md memory hierarchy; settings and permission rules
24. Custom slash commands and skills
25. Hooks: lifecycle events and practical uses
26. Subagents; MCP server configuration scopes
27. Headless mode and CI (e.g., GitHub Actions); hands-on: give cca-labs a CLAUDE.md, a hook, a command and a subagent
28. Week 4 review

Week 5: Agentic Architecture & Orchestration (largest domain)
29. What makes a system agentic; agents vs workflows vs conversational systems; when simpler patterns win
30. Workflow patterns: chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer
31. Task decomposition, sequential vs parallel execution, dynamic planning, replanning, handling ambiguity
32. Claude Agent SDK fundamentals; hands-on: an Order Investigator agent that uses your MCP server
33. Multi-agent systems: orchestrator–subagent, context isolation, hub-and-spoke / pipeline / peer-to-peer, handoffs; hands-on: add a subagent
34. Reliability and safety: failure modes, retries, idempotent tool actions, guardrails, human-in-the-loop, stopping conditions, observability, cost control
35. Week 5 review

Week 6: Context Management + exam practice
36. Context as a budget: what fills it, quality loss in very long contexts, choosing what to include
37. Prompt caching: cached prefixes, cache lifetime, cost impact, structuring prompts for cache hits; hands-on: measure cache hits in your agent
38. Long-running agents: compaction/summarization, external memory, retrieval basics, what a subagent gets vs what the orchestrator keeps
39. Full timed mock #1 (120 min); log every wrong answer with why the right option wins
40. Targeted revision of my two weakest domains (from the mock log and confidence ratings)
41. Full timed mock #2 using a different question set; review
42. Final review (light day): one-page cheat sheet, exam-day rules from the official exam policy

## Tech stack
Latest stable Next.js (App Router), TypeScript strict, Tailwind CSS, Zod, Vitest. Mobile-friendly, dark mode.

## Data: JSON files only
Content (read-only, committed): content/week-1.json … content/week-6.json, validated with Zod.
- Day: day, week, title, domain (foundations | agentic-architecture | tool-design-mcp | claude-code | prompt-engineering | context-management | exam-practice), estMinutes, objectives[], keyPoints[] (4–6 revision bullets), connectToExperience?, tasks[], selfCheck[]
- Task: id, type (recall | study | hands-on | practice | revise | quiz), title, details, estMinutes, resources[] of { title, url }
- SelfCheck: question, options[4], answerIndex, explanation
- Task IDs are stable strings like "d07-t3". Never renumber them; new tasks get new IDs, so saved progress survives content edits.

Progress (writable): progress.json
{ schemaVersion: 1, startDate: "YYYY-MM-DD" | null, updatedAt, tasks: { [taskId]: { done, completedAt } }, days: { [day]: { notes, confidence (1–5) } } }

## Storage: pluggable, selected by STORAGE_DRIVER
ProgressStore interface: read() → { data, version }; write(data, expectedVersion).
- file (default; VPS/Docker): path from PROGRESS_FILE_PATH (default ./data/progress.json), created on first read. Serialize writes with an in-process lock and write atomically (temp file + rename). data/ is gitignored.
- github (for Vercel/Netlify, where the runtime filesystem is read-only): progress.json lives in a SEPARATE private repo and is read and committed via the GitHub Contents API. Env: GITHUB_TOKEN (fine-grained PAT with contents read/write on that repo only), GITHUB_REPO, GITHUB_BRANCH, GITHUB_PROGRESS_PATH. The file's sha is the version; on a conflict, re-read, re-apply the operation and retry up to 3 times. Using a separate repo keeps progress commits from triggering redeploys.

## API (Route Handlers, Node runtime, never cached)
- GET /api/progress
- PATCH /api/progress with idempotent operations (set values, never toggle): setTask { taskId, done } | setNotes { day, notes } | setConfidence { day, value } | setStartDate { date }
- All operations go through a pure applyOperation() that validates IDs against the content
- GET /api/progress/export (download) and POST /api/progress/import (validated full replace)

## Auth
Single user. APP_PASSCODE env var; /login sets an httpOnly, signed (SESSION_SECRET) 30-day cookie. Protect every page and API route except /login, using middleware or proxy, whichever the installed Next.js version uses.

## Pages
- / Dashboard: overall %, progress per week and per exam domain, a "Today" card (first day with incomplete tasks), ahead/behind vs startDate, streak (consecutive days with at least one completed task), hours done vs remaining, weakest domains by confidence
- /roadmap: all 42 days by week, with domain tag, estimate and status; filters: incomplete only, by domain
- /day/[n]: objectives, key points, tasks with checkboxes (type badge, estimate, links), self-check questions (pick an option → reveal answer and explanation), notes with debounced autosave, confidence 1–5, prev/next navigation
- /settings: start date, export, import, reset (with confirmation)
Client behavior: optimistic updates with rollback and a visible Saving / Saved / Failed–retry state; refetch on window focus so home and office always show the latest. Compute dates and streaks in the browser's local time zone.

## Quality
Vitest tests for applyOperation, FileStore (temp dir, concurrent writes), GitHubStore (mocked fetch, conflict retry) and content integrity (days 1–42 present, unique task IDs, well-formed https URLs, answerIndex in range). Lint, typecheck and tests must pass after every stage.

## Deployment
Dockerfile (multi-stage, standalone output), docker-compose.yml mounting ./data as a volume, .env.example, and a README covering: running locally, deploying on a VPS with Docker, and deploying on Vercel with the github driver (including PAT setup).

## How to work
1. Save this brief as docs/SPEC.md and write a concise CLAUDE.md (stable task IDs, content schema, storage drivers, commands).
2. Before coding, show me: an architecture summary, the file tree, both schemas, and the 42 day titles. Wait for my approval.
3. Build in stages and stop after each for my review: (a) scaffold, storage, API, tests; (b) UI; (c) content, one week at a time, each week checked against its sources and the schema before starting the next; (d) auth, deployment files, README.