# Chronicle Extension Spec

## What It Is

A pi extension (TypeScript) that runs alongside any coding session. It observes the conversation and **automatically maintains a living documentation set** in the project's `docs/` directory. Where scribe records *what happened* (session traces), chronicle records *what is* and *what was decided* (project knowledge).

The two are complementary:
- **Scribe** = temporal record (session traces, narrative of work)
- **Chronicle** = spatial record (project structure, decisions, domain model)
- Together = a decision register with both *when/why* and *what*

Chronicle produces **atomic documentation files** — one concept per file, linked, searchable, and version-controlled alongside the code they describe.

---

## The Subagent Loop

Chronicle spawns a **real agent** — not a structured-output LLM call. After each
main agent loop, chronicle fires up a subagent (via the pi SDK's
`createAgentSession()`) with its own tools and system prompt. This agent can:

- **Read** existing docs to understand what's already documented
- **Read** source files if it needs more context about a change
- **Write** new doc files with proper frontmatter
- **Edit** existing docs when something changed
- **Read** the chronicle index to understand the current doc landscape

```
Main loop:    user ↔ working agent
                         ↕ (agent_end fires)
Chronicle:    subagent with tools → reads/writes docs/ directory
```

The subagent receives:
1. A summary of the latest exchange (conversation text, same as scribe)
2. The current chronicle index (list of existing docs with titles/categories)
3. A system prompt tuned for documentation extraction

Because it has tools, it can make its own decisions: read a doc to check if it's
still accurate, write a new one, update an existing one, or do nothing. No
structured output parsing needed — the agent just acts.

### Why a subagent, not a simple LLM call

- **Context**: It can `read` existing docs and source files to make informed decisions
  about whether an update is needed, rather than relying on a summary
- **Multi-step**: It can create a doc AND update the index AND check for related docs
  in a single run, rather than one action per invocation
- **Robustness**: No brittle parsing of CREATE/UPDATE/NO_CHANGE responses — the agent
  uses tools or doesn't
- **Consistency**: Same tool semantics as the main agent — `write` creates files,
  `edit` patches them, paths resolve the same way

---

## Doc File Format

Each doc file is a markdown file with YAML frontmatter, stored in `docs/chronicle/`.

```markdown
---
doc_id: D-{8 hex chars}
title: User Authentication Flow
category: architecture
created_at: 2026-03-05T09:14:00Z
updated_at: 2026-03-05T11:22:00Z
created_by_session: 01JXYZ1234ABCDEF
updated_by_sessions:
  - 01JXYZ1234ABCDEF
  - 01JXYZ5678GHIJKL
status: current
supersedes: ~
tags: [auth, api, middleware]
related:
  - jwt-token-strategy
  - session-management
---

# User Authentication Flow

Brief description of the authentication architecture...

## Details

Specifics of the implementation approach...

## Open Questions

- Should we support OAuth in addition to JWT?
```

### File naming

`{slug}.md` in `docs/chronicle/` — e.g., `docs/chronicle/user-authentication-flow.md`

### Categories

- `architecture` — system design, component relationships, data flow
- `domain-model` — entities, value objects, aggregates, domain rules
- `decision` — explicit choices made and their rationale (ADR-like)
- `convention` — coding patterns, naming schemes, project norms
- `plan` — future work, roadmaps, open directions
- `api` — interface contracts, endpoint specs, event schemas
- `infrastructure` — deployment, CI/CD, environment config

### Status

- `current` — reflects the present state of the project
- `draft` — initial capture, may need refinement
- `superseded` — replaced by a newer doc (link via `supersedes` field)
- `deprecated` — no longer applicable

---

## The Index

Chronicle maintains a manifest file at `docs/chronicle/_index.md`:

```markdown
---
generated_at: 2026-03-05T11:30:00Z
doc_count: 12
---

# Chronicle Index

## Architecture
- [[user-authentication-flow]] — JWT-based auth with middleware chain
- [[event-bus-design]] — Async event system for cross-service communication

## Domain Model
- [[order-aggregate]] — Order lifecycle and invariants
- [[pricing-rules]] — Discount tiers and calculation logic

## Decisions
- [[adr-001-database-choice]] — PostgreSQL over MongoDB for transactional guarantees
- [[adr-002-monorepo-structure]] — Turborepo with shared packages

## Conventions
- [[error-handling-pattern]] — Result types over exceptions
- [[naming-conventions]] — File, variable, and API naming rules

## Plans
- [[v2-api-migration]] — Breaking changes planned for Q2
```

This index is regenerated whenever a doc is created or updated. It serves as the entry point for both humans and the agent.

---

## When Chronicle Acts

The subagent has its own judgment about when to act. The system prompt biases it
heavily toward doing nothing — most turns produce no doc changes. But when it does
act, it has full tool access to do the right thing.

**Typical CREATE situations:**
- A new entity, service, or component is introduced
- An architectural decision is made with explicit rationale
- A convention or pattern is established for the first time
- A future plan or roadmap item is articulated
- A domain rule or invariant is defined

**Typical UPDATE situations:**
- An existing model or interface changes
- A previous decision is revised or extended
- A convention evolves (e.g., new error handling approach)
- A plan's scope or timeline changes
- An open question from a doc is resolved

**Typical no-op situations:**
- Routine implementation that doesn't change the documented model
- Bug fixes that don't reveal new architectural knowledge
- File reads, exploration, or information gathering
- Conversations about non-project topics

The subagent can also do **multi-step work** in a single invocation:
- Read an existing doc → decide it needs updating → edit it → update the index
- Create a new doc → check for related docs → add wikilinks → update the index
- Read source files for context → decide a doc is now inaccurate → update it

This is the key advantage over structured output: the agent adapts its behavior
to what it finds, rather than following a rigid action template.

---

## Subagent System Prompt

The chronicle subagent receives a system prompt that defines its role and
the doc file conventions. Because it has tools, the prompt focuses on *judgment*
rather than output formatting:

```
You are a project chronicler. You observe a coding session's latest exchange and
decide whether any project knowledge changed enough to warrant documentation.

You have access to read and write tools. The project's chronicle docs live at:
{docs_dir}/

CURRENT INDEX:
{index_contents}

Your job:
1. Read the latest exchange below.
2. Decide: did any structural project knowledge change?
3. If yes, use your tools to create or update the appropriate doc(s).
4. If no, do nothing — just respond "No documentation changes needed."

You are looking for changes to:
- Domain model (entities, relationships, invariants, business rules)
- Architecture (components, data flow, service boundaries)
- Decisions (choices made with rationale — why X over Y)
- Conventions (patterns, naming, error handling approaches)
- Plans (future work, migrations, roadmap items)
- APIs (contracts, schemas, endpoint behavior)

When you DO write, follow these rules:

FILE FORMAT: Each doc is a markdown file at {docs_dir}/{slug}.md with this frontmatter:
---
doc_id: D-{8 hex chars}
title: Human Readable Title
category: architecture|domain-model|decision|convention|plan|api|infrastructure
created_at: {ISO 8601}
updated_at: {ISO 8601}
session_id: {current_session_id}
status: current
tags: [relevant, tags]
related: [other-doc-slug]
---

WRITING RULES:
- One doc = one concept. Keep docs atomic.
- 50-200 words typical, never more than 500.
- Write in present tense ("The system uses..." not "We decided to use...")
- For decisions, always include the rationale and alternatives considered.
- Link to related docs using [[slug]] wikilinks in the body.
- If updating an existing doc, read it first, then use edit for surgical changes
  or write for full replacement. Update the `updated_at` timestamp.
- After creating or updating docs, also update {docs_dir}/_index.md to reflect
  the current set of docs grouped by category.

JUDGMENT RULES:
- Bias toward NOT writing. Most exchanges don't produce documentation-worthy changes.
- Don't document implementation details — that's what the code is for.
- Don't document what happened — that's what scribe traces are for.
- DO document what IS: the current state of the system's design, rules, and plans.
- Routine bug fixes, file reads, exploration, and clarifying questions → no docs.
- If you're unsure whether something is worth documenting, don't.
```

The user message sent to the subagent contains the conversation summary (same
`messagesToText()` format as scribe).

---

## Configuration

Chronicle reads from `.pi/chronicle.json` in the project root (or falls back to defaults):

```json
{
  "docs_dir": "docs/chronicle",
  "enabled": true,
  "provider": "anthropic",
  "model": "claude-haiku-4-5",
  "categories": ["architecture", "domain-model", "decision", "convention", "plan", "api", "infrastructure"],
  "auto_commit": false,
  "subagent_timeout_ms": 30000
}
```

- `docs_dir` — where docs live, relative to project root (default: `docs/chronicle`)
- `enabled` — kill switch (default: true)
- `provider/model` — which model the subagent uses (default: anthropic/claude-haiku-4-5). Haiku is fast and cheap enough to run after every turn without concern.
- `categories` — which categories to track (subset to narrow focus). Injected into the subagent's system prompt so it knows what to look for.
- `auto_commit` — if true, `git add` new/updated docs automatically (default: false, since the main agent already handles git)
- `subagent_timeout_ms` — max time the subagent gets per invocation (default: 30s). Prevents runaway loops.

Falls back to reading provider/model from `.pi/notebook.json` scribe config if chronicle-specific config isn't set, for consistency.

---

## Extension Hooks

```
session_start:
  - Read/create docs_dir and _index.md
  - Count existing docs for status bar
  - Set status bar
  - Store reference to modelRegistry and authStorage from ctx for subagent use

before_agent_start:
  - Inject docs awareness into system prompt:
    "This project has chronicle documentation at {docs_dir}/. 
     The chronicler extension auto-maintains these docs.
     You can reference them with [[slug]] links.
     Current index: {brief list of doc slugs and titles}"

tool_call:
  - Track files modified (same as scribe) for session attribution

agent_end:
  - If subagent already in flight, skip (prevent overlap)
  - Read current _index.md contents
  - Build conversation summary from event.messages (same as scribe's messagesToText)
  - Spawn subagent via createAgentSession():
      tools: [read, write, edit]  (no bash — chronicle doesn't need shell access)
      model: configured sideband model (default: claude-haiku-4-5)
      systemPrompt: chronicle system prompt with index + docs_dir interpolated
  - Send conversation summary as the prompt
  - Fire and forget (async, non-blocking — same pattern as scribe)
  - On completion: recount docs, update status bar

session_shutdown:
  - Wait for any in-flight subagent to complete (with timeout)
  - Regenerate _index.md if any docs were touched this session

turn_end:
  - Recount docs in docs_dir
  - Update status bar with doc count / session activity
```

### Subagent Lifecycle

The subagent is ephemeral — a new `AgentSession` is created for each invocation
and disposed after. It uses an in-memory `SessionManager` (no persistence needed)
and borrows the parent session's `modelRegistry` for API key resolution.

```typescript
// Pseudocode — actual implementation in index.ts
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRegistry: ctx.modelRegistry,  // borrow from parent
  tools: [readTool, writeTool, editTool],  // no bash
  model: getModel(config.provider, config.model),
});

session.subscribe((event) => {
  // Optional: log subagent activity for debugging
});

await session.prompt(conversationSummary);
session.dispose();
```

The subagent runs in the same process, same cwd. Its `write` and `edit` tools
operate on the real filesystem — when it writes to `docs/chronicle/foo.md`,
that file actually appears. No sandboxing needed; the system prompt constrains
it to the docs directory.

---

## Status Bar

Always visible alongside scribe's status:

```
[chronicle: 12 docs | 2 updated this session]
```

When a doc is created or updated, briefly flash:
```
[chronicle: created → user-authentication-flow]
```

---

## Commands

### `/chronicle`

Shows the current index in the overlay (same UX pattern as `/scribe`).

### `/chronicle:search <query>`

Searches doc titles and tags for a keyword. Returns matching docs with one-line summaries. Useful when the agent needs to check what's already documented before creating something new.

### `/chronicle:show <slug>`

Shows the full content of a specific doc in the overlay.

---

## Interaction with Scribe

When both extensions are loaded:

1. **Session traces reference docs**: When chronicle creates or updates a doc, scribe's trace gets an entry like:
   ```
   ## 10:15 — Chronicle: created user-authentication-flow
   New architecture doc capturing the JWT-based auth design.
   ```

2. **Decision archaeology**: A user can trace *when* a decision was made (scribe traces, by session ID in the doc's `created_by_session` / `updated_by_sessions`) and *what* was decided (chronicle doc). This is the decision register.

3. **Reflection integration**: The reflection skill can read both traces and chronicle docs to identify patterns like "we keep revisiting this decision" or "this area of the domain model has changed 4 times in 3 sessions."

---

## Interaction with Git

Chronicle docs live in the repo and are version-controlled. This means:

- `git log docs/chronicle/` shows documentation evolution
- `git blame docs/chronicle/order-aggregate.md` shows when each line was written
- PRs naturally include doc updates alongside code changes
- The `updated_by_sessions` frontmatter field lets you cross-reference git commits with pi session traces

The extension does NOT auto-commit. Docs are staged with code changes and committed together, maintaining the natural coupling.

---

## Bootstrapping (Existing Projects)

When chronicle first runs on a project with no existing docs:

1. Creates `docs/chronicle/` and `_index.md`
2. Does NOT attempt to document the entire project from scratch
3. Starts observing from this point forward — docs accumulate organically
4. The user can manually trigger a bootstrap via `/chronicle:bootstrap` which:
   - Reads key project files (README, package.json, src/ structure)
   - Generates initial architecture and domain-model docs
   - Presents them for review before writing

This respects the "observe, don't intrude" principle. Documentation builds up naturally through work, not through a one-time dump.

---

## What Chronicle Does NOT Do

- Does not document every code change (that's git's job)
- Does not produce API reference docs from source (that's typedoc/jsdoc's job)
- Does not replace README.md (chronicle docs are internal project knowledge)
- Does not auto-commit or push (docs flow with normal git workflow)
- Does not analyse patterns across docs (that's reflection's concern)
- Does not block or interrupt the main conversation
- Does not duplicate what scribe records (traces = temporal, chronicle = spatial)
- Does not attempt to be comprehensive — it captures what surfaces through work

---

## File Structure

```
project/
├── docs/
│   └── chronicle/
│       ├── _index.md                    # Auto-generated index
│       ├── user-authentication-flow.md  # Architecture doc
│       ├── order-aggregate.md           # Domain model doc
│       ├── adr-001-database-choice.md   # Decision doc
│       ├── error-handling-pattern.md    # Convention doc
│       └── v2-api-migration.md          # Plan doc
├── .pi/
│   ├── extensions/
│   │   ├── scribe/                      # Existing
│   │   └── chronicle/                   # This extension
│   │       ├── index.ts
│   │       └── package.json
│   └── chronicle.json                   # Optional config
└── src/
    └── ...
```

---

## Design Principles

1. **Atomic**: One doc = one concept. No mega-documents.
2. **Living**: Docs update as the project evolves. No write-once artifacts.
3. **Observable**: The sideband pattern means zero friction — docs appear as a side effect of work.
4. **Linked**: Docs reference each other via wikilinks. The graph tells a story.
5. **Versioned**: Docs live in git. History is preserved naturally.
6. **Minimal**: Bias toward under-documenting. Capture structure, not implementation.
7. **Composable**: Chronicle + scribe + reflection = full project memory system.
