export const DOMAINS = [
  "foundations",
  "agentic-architecture",
  "tool-design-mcp",
  "claude-code",
  "prompt-engineering",
  "context-management",
  "exam-practice",
] as const;

export type Domain = (typeof DOMAINS)[number];

interface DomainInfo {
  label: string;
  /** Domain number and weight (%) in the exam guide; null for the two non-exam domains. */
  exam: { number: number; weight: number } | null;
}

export const DOMAIN_INFO: Record<Domain, DomainInfo> = {
  foundations: { label: "Foundations", exam: null },
  "agentic-architecture": { label: "Agentic Architecture & Orchestration", exam: { number: 1, weight: 27 } },
  "tool-design-mcp": { label: "Tool Design & MCP Integration", exam: { number: 2, weight: 18 } },
  "claude-code": { label: "Claude Code Configuration & Workflows", exam: { number: 3, weight: 20 } },
  "prompt-engineering": { label: "Prompt Engineering & Structured Output", exam: { number: 4, weight: 20 } },
  "context-management": { label: "Context Management & Reliability", exam: { number: 5, weight: 15 } },
  "exam-practice": { label: "Exam practice", exam: null },
};

export const TASK_STATEMENT_IDS = [
  "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7",
  "2.1", "2.2", "2.3", "2.4", "2.5",
  "3.1", "3.2", "3.3", "3.4", "3.5", "3.6",
  "4.1", "4.2", "4.3", "4.4", "4.5", "4.6",
  "5.1", "5.2", "5.3", "5.4", "5.5", "5.6",
] as const;

export type TaskStatementId = (typeof TASK_STATEMENT_IDS)[number];

/** Task statement titles as written in the exam guide. */
export const TASK_STATEMENT_TITLES: Record<TaskStatementId, string> = {
  "1.1": "Design and implement agentic loops for autonomous task execution",
  "1.2": "Orchestrate multi-agent systems with coordinator-subagent patterns",
  "1.3": "Configure subagent invocation, context passing, and spawning",
  "1.4": "Implement multi-step workflows with enforcement and handoff patterns",
  "1.5": "Apply Agent SDK hooks for tool call interception and data normalization",
  "1.6": "Design task decomposition strategies for complex workflows",
  "1.7": "Manage session state, resumption, and forking",
  "2.1": "Design effective tool interfaces with clear descriptions and boundaries",
  "2.2": "Implement structured error responses for MCP tools",
  "2.3": "Distribute tools appropriately across agents and configure tool choice",
  "2.4": "Integrate MCP servers into Claude Code and agent workflows",
  "2.5": "Select and apply built-in tools (Read, Write, Edit, Bash, Grep, Glob) effectively",
  "3.1": "Configure CLAUDE.md files with appropriate hierarchy, scoping, and modular organization",
  "3.2": "Create and configure custom slash commands and skills",
  "3.3": "Apply path-specific rules for conditional convention loading",
  "3.4": "Determine when to use plan mode vs direct execution",
  "3.5": "Apply iterative refinement techniques for progressive improvement",
  "3.6": "Integrate Claude Code into CI/CD pipelines",
  "4.1": "Design prompts with explicit criteria to improve precision and reduce false positives",
  "4.2": "Apply few-shot prompting to improve output consistency and quality",
  "4.3": "Enforce structured output using tool use and JSON schemas",
  "4.4": "Implement validation, retry, and feedback loops for extraction quality",
  "4.5": "Design efficient batch processing strategies",
  "4.6": "Design multi-instance and multi-pass review architectures",
  "5.1": "Manage conversation context to preserve critical information across long interactions",
  "5.2": "Design effective escalation and ambiguity resolution patterns",
  "5.3": "Implement error propagation strategies across multi-agent systems",
  "5.4": "Manage context effectively in large codebase exploration",
  "5.5": "Design human review workflows and confidence calibration",
  "5.6": "Preserve information provenance and handle uncertainty in multi-source synthesis",
};
