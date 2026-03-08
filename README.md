# pi-think

Composable [pi](https://pi.dev) packages for metacognitive loops with AI — capture thinking, observe what you're doing, orient on what matters, and evolve how you work.

This is not a specific note-taking workflow or productivity system. It's a modular starting point: a set of independently installable packages that help you grow the right way of thinking and working out of whatever knowledge system you're already using.

<img width="1582" height="1030" alt="image" src="https://github.com/user-attachments/assets/ac5fcc26-bbb3-4ae8-8a6d-9b2e21e12f9a" />


## The Compounding Loop

Each pass through the loop feeds the next. Captures become material for breadcrumbs. Breadcrumbs inform briefings. Briefings surface what to reflect on. Reflections shape what you notice and capture next.

```
                    ┌─────────────────────────────────┐
                    │                                  │
                    ▼                                  │
              ┌──────────┐                             │
              │ /capture │  get it out of your head    │
              └────┬─────┘                             │
                   │ atomic notes                      │
                   ▼                                   │
              ┌──────────┐                             │
              │  /crumb  │  where is my head at?       │
              └────┬─────┘                             │
                   │ themes, momentum, questions       │
                   ▼                                   │
              ┌──────────┐                             │
              │ /recent  │  what's alive right now?    │
              └────┬─────┘                             │
                   │ orientation, entry points         │
                   ▼                                   │
              ┌──────────┐                             │
              │ /reflect │  what patterns am I in?     │
              └────┬─────┘                             │
                   │ evolved understanding             │
                   │                                   │
                   └───────────────────────────────────┘
                     shapes what you notice next
```

The loop compounds over time. Early sessions produce scattered notes. After a few cycles, breadcrumbs reveal themes. After a few more, reflections surface patterns you wouldn't have seen at the level of individual sessions. The configuration of your thinking environment evolves as a side effect of using it.

## Packages

Each package is independently installable:

Install everything at once from git:

```bash
pi install git:github.com/bfollington/pi-think
```

Or install individual packages by local path (after cloning):

```bash
pi install ~/code/pi-think/packages/scribe
pi install ~/code/pi-think/packages/chronicle
pi install ~/code/pi-think/packages/notebook
pi install ~/code/pi-think/packages/reflection
pi install ~/code/pi-think/packages/qmd
pi install ~/code/pi-think/packages/concepts
```

### Scribe (extension)

Session trace recorder. Runs a sideband LLM call after each agent loop to maintain a running markdown trace of meaningful transitions — decisions, direction changes, open questions. Traces are the raw material that reflections synthesise over. The user can view and write into traces via `/scribe` or `Ctrl+Shift+S`.

### Chronicle (extension)

Auto-documentation. Spawns a subagent after each agent loop that observes the conversation and creates/updates atomic documentation files in `docs/chronicle/`. Captures architecture, domain model, decisions, conventions, and plans as they surface through work.

### Notebook (skill)

Convention system for atomic, Obsidian-compatible notes with YAML frontmatter and wikilinks. Teaches the agent how to create, link, and organise notes in a knowledge base. Includes:

- **`/setup`** — Configure pi-think for your project (choose notes directory, detect Obsidian vault, etc.)
- **`/capture`** — Break raw thought into atomic linked notes (with the index card test and proposed chunking)
- **`/crumb`** — Drop a breadcrumb: snapshot your thinking state with themes, momentum, and open questions
- **`/recent`** — Get a headspace briefing on what's active, what's stalled, and where to re-enter

Works standalone or alongside scribe (traces become graph nodes in Obsidian). When the `obsidian` CLI is available, prefers it over raw filesystem operations.

### QMD (skill)

Semantic search over markdown vaults using [qmd](https://github.com/tobi/qmd). Hybrid BM25 + vector search with local models (no API calls). Composes with notebook — replaces grep with semantic search in the "search before create" step.

### Concepts (extension + skill)

Domain ontology management. Define the concepts that structure how you think about your project — not code types or database schemas, but the mental models you work with. A breadcrumb is different from a reflection is different from a trace, even though they're all markdown files. The distinctions matter because they shape how you *think*.

Concepts are stored as markdown files in `.concepts/`, injected into the system prompt at session start, and updated through explicit conversation. Includes:

- **`/define`** — Define or refine a concept
- **`/suggest-concepts`** — Examine the project and propose concepts worth defining
- **`/concepts`** — Quick-list the current ontology (extension command)

**This is an advanced feature.** You wouldn't start here. It becomes relevant after you've been running the loop long enough that recurring vocabulary, implicit distinctions, and named patterns have emerged. Defining an ontology is a philosophical endeavour — it's powerful precisely because it forces you to articulate what you mean, but not everyone wants or needs that immediately.

### Reflection (skill)

Metacognition across accumulated session traces. Reads unreflected traces and synthesises patterns, recurring themes, open questions, and evolved thinking. Invoke with `/reflect`. This is the synthesis step of the loop — it turns raw session records into higher-order observations.

## How They Compose

```
Scribe     — temporal record: what happened, session by session
Chronicle  — spatial record: what IS, the living state of the project
Notebook   — knowledge base: notes, ideas, breadcrumbs, linked thinking
QMD        — search: semantic retrieval across the knowledge base
Concepts   — ontology: the named distinctions that structure thinking
Reflection — synthesis: patterns across all of the above
```

Each is independently useful. Together they form a compounding system:

- **Scribe + Reflection** = metacognitive loop (observe → synthesise)
- **Notebook + QMD** = searchable knowledge base with semantic recall
- **Notebook + Scribe** = traces as graph nodes, notes created during sessions linked to their context
- **Concepts + Reflection** = ontology that evolves as patterns are named
- **All six** = self-documenting, self-reflecting project with shared vocabulary and full-text + vector search

## Design Philosophy

**Grow, don't prescribe.** These packages provide universally applicable processes — capturing, connecting, orienting, reflecting — not a specific methodology. The goal is to help you discover what works through repeated observation, not to impose a workflow.

**Three perspectives on the same work.** Scribe traces record what the agent observed during sessions. Breadcrumbs capture where the user's head is at. Reflections synthesise patterns across both. Different perspectives compound into richer understanding than any single view.

**Start anywhere.** Install just scribe for session records. Add notebook when you want to capture thinking. Add reflection when you have enough traces to synthesise over. Each package adds value independently; together they form the full loop.

## Package Structure

```
packages/
├── scribe/           # Extension: session traces
├── chronicle/        # Extension: auto-documentation
├── notebook/         # Skill + prompts: note-taking, breadcrumbs, briefings
├── qmd/              # Skill: semantic search via qmd
├── concepts/         # Extension + skill + prompts: domain ontology
└── reflection/       # Skill + prompt: cross-session synthesis
```

Each package follows pi's conventional directory layout (`extensions/`, `skills/`, `prompts/`) and can be installed independently via `pi install <path>`.
