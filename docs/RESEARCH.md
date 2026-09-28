# Step 0 research log

Checked on 2026-09-28. "Opened" means the page was fetched and read. Pages listed only in an official index must be opened before they are cited in content.

## Exam facts (official)

Sources: the exam guide PDF and the certification FAQ (links below).

| Fact | Value |
|---|---|
| Name / code | Claude Certified Architect – Foundations (CCAR-F) |
| Items / time | 60 items in 120 minutes (plan for ~135 min seat time) |
| Item types | Multiple-choice **and multiple-response**; each item says how many responses to select |
| Structure | Scenario-based: 4 scenarios drawn at random from a pool of 6 |
| Passing | Scaled score 720 on a 100–1,000 scale |
| Delivery | Proctored through Pearson VUE, online or at a test center |
| Eligibility (FAQ) | People at Claude Partner Network organizations; 18+ |
| Official practice exam | Retired in the move to Pearson (FAQ) |
| Retakes (FAQ) | Wait 14 days after the 1st attempt, 30 after the 2nd, 90 after the 3rd; max 4 per rolling 12 months |
| Validity | 12 months |

Price is deliberately not recorded here; link the certification page instead.

## Domains and weights (exam guide)

| # | Official name | Weight | Slug in this app |
|---|---|---|---|
| 1 | Agentic Architecture & Orchestration | 27% | `agentic-architecture` |
| 2 | Tool Design & MCP Integration | 18% | `tool-design-mcp` |
| 3 | Claude Code Configuration & Workflows | 20% | `claude-code` |
| 4 | Prompt Engineering & Structured Output | 20% | `prompt-engineering` |
| 5 | Context Management & Reliability | 15% | `context-management` |

## Task statements → roadmap days (as in docs/PLAN.md)

| Task statement | Days |
|---|---|
| 1.1 Agentic loops for autonomous task execution | 15, 29 |
| 1.2 Multi-agent systems with coordinator–subagent patterns | 33 |
| 1.3 Subagent invocation, context passing and spawning | 33 |
| 1.4 Multi-step workflows with enforcement and handoff patterns | 25, 34 |
| 1.5 Agent SDK hooks for tool-call interception and data normalization | 32 |
| 1.6 Task decomposition strategies for complex workflows | 31 |
| 1.7 Session state, resumption and forking | 38 |
| 2.1 Tool interfaces with clear descriptions and boundaries | 17 |
| 2.2 Structured error responses for MCP tools | 17, 19 |
| 2.3 Distributing tools across agents; tool_choice | 16, 17 |
| 2.4 Integrating MCP servers into Claude Code and agent workflows | 18, 20, 26 |
| 2.5 Built-in tools (Read, Write, Edit, Bash, Grep, Glob) | 22 |
| 3.1 CLAUDE.md hierarchy, scoping, modular organization | 23 |
| 3.2 Custom slash commands and skills | 24 |
| 3.3 Path-specific rules | 23 |
| 3.4 Plan mode vs direct execution | 22, 26 |
| 3.5 Iterative refinement techniques | 24 |
| 3.6 Claude Code in CI/CD | 27 |
| 4.1 Explicit criteria to improve precision and reduce false positives | 8 |
| 4.2 Few-shot prompting for consistency and quality | 10 |
| 4.3 Structured output with tool use and JSON schemas | 6, 16 |
| 4.4 Validation, retry and feedback loops for extraction | 12 |
| 4.5 Batch processing strategies | 5 |
| 4.6 Multi-instance and multi-pass review | 27, 31 |
| 5.1 Preserving critical information across long interactions | 4, 36 |
| 5.2 Escalation and ambiguity resolution | 34 |
| 5.3 Error propagation across multi-agent systems | 34 |
| 5.4 Context in large codebase exploration | 38 |
| 5.5 Human review workflows and confidence calibration | 13 |
| 5.6 Provenance and uncertainty in multi-source synthesis | 36 |

## Scenario pool (4 of these 6 appear)

1. Customer Support Resolution Agent (Agent SDK; get_customer, lookup_order, process_refund, escalate_to_human)
2. Code Generation with Claude Code
3. Multi-Agent Research System
4. Developer Productivity with Claude
5. Claude Code for Continuous Integration
6. Structured Data Extraction

The guide also has 4 preparation exercises (multi-tool agent with escalation; Claude Code team workflow; extraction pipeline; multi-agent research pipeline) and 12 sample questions with explanations.

## Out of scope per the guide, and where the roadmap still teaches it as foundation

| Out of scope | Day |
|---|---|
| Rate limits, quotas, pricing calculations; model benchmarks | 3 |
| Streaming / server-sent events; token counting specifics | 5 |
| Vision / image analysis | 6 |
| OAuth and auth protocol details; deploying or hosting MCP servers | 20 |
| Prompt caching implementation details (beyond knowing it exists) | 37 |
| Fine-tuning, embeddings / vector DBs, computer use, model internals | not covered |

## Notes that affect content

- `docs.claude.com` now redirects to `platform.claude.com/docs` (API docs). Claude Code and Agent SDK docs live at `code.claude.com/docs`.
- MCP's latest spec is **2026-07-28** (previous: 2025-11-25). It is stateless: the `initialize` handshake and protocol sessions are gone, `server/discover` is new, change notifications use `subscriptions/listen`, and Roots, Sampling and Logging are deprecated. Check TypeScript SDK support before writing Days 18–19.
- The exam guide calls the subagent-spawning tool "Task" with `allowedTools` including "Task". Check the name in the current Agent SDK docs when writing Week 5 and teach both if they differ.
- Next.js 16 renamed `middleware.ts` to `proxy.ts`; proxy runs on the Node.js runtime by default.

## Sources opened

Official (Anthropic):
- Certification page (the brief's link redirects here): https://anthropic-partners.skilljar.com/claude-certified-architect-foundations-certification
- Exam guide PDF: https://everpath-course-content.s3-accelerate.amazonaws.com/instructor%2F6nizmqk8tpzpfjvt6qmmav7rh%2Fpublic%2F1783542750%2FClaude+Certified+Architect+%E2%80%93+Foundations+Exam+Guide.pdf
- Exam policy PDF: https://everpath-course-content.s3-accelerate.amazonaws.com/instructor%2F34hhd92iyp94a0gtbr15cy5jk%2Fpublic%2F1782870704%2FAnthropic+Certification+Exam+Policy.pdf
- Certification FAQ: https://anthropic-partners.skilljar.com/page/faq-certifications
- Exam prep courses: https://anthropic-partners.skilljar.com/page/claude-certification-exam-prep-courses
- Architect Foundations prep courses: https://anthropic-partners.skilljar.com/page/claude-certified-architect-foundations-prep-courses
- Public course catalog: https://anthropic.skilljar.com/
- Building effective agents: https://www.anthropic.com/engineering/building-effective-agents
- API docs home: https://platform.claude.com/docs/en/intro
- API docs index: https://platform.claude.com/llms.txt
- Claude Code and Agent SDK docs index: https://code.claude.com/docs/llms.txt

Official (MCP):
- Architecture overview: https://modelcontextprotocol.io/docs/learn/architecture
- Docs index: https://modelcontextprotocol.io/llms.txt
- 2026-07-28 key changes: https://modelcontextprotocol.io/specification/2026-07-28/changelog
- SDKs: https://modelcontextprotocol.io/docs/2026-07-28/sdk

Community (not affiliated with Anthropic):
- Claude Certification Guide: https://claudecertificationguide.com
- Its full mock exam (60 questions, 120 min): https://claudecertificationguide.com/mock-exam
- Szymon Paluch, 60-question practice exam with a timed exam mode: https://szymonpaluch.com/blog/posts/claude-certified-architect-practice-questions

Stack:
- Next.js proxy file convention: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
