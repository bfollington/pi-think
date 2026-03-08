# pi-think

Composable pi packages for project memory — traces, documentation, notes, and reflection.

## Packages

Each package is independently installable into any project:

```bash
pi install ~/code/pi-think/packages/scribe
pi install ~/code/pi-think/packages/chronicle
pi install ~/code/pi-think/packages/notebook
pi install ~/code/pi-think/packages/reflection
pi install ~/code/pi-think/packages/qmd
```

Or from a git remote:

```bash
pi install git:github.com/you/pi-think   # installs all packages
```

### Scribe (extension)

Session trace recorder. Runs a sideband LLM call after each agent loop to maintain
a running markdown trace of meaningful transitions — decisions, direction changes,
open questions. The user can view and write into traces via `/scribe` or `Ctrl+Shift+S`.

### Chronicle (extension)

Auto-documentation. Spawns a subagent after each agent loop that observes the
conversation and creates/updates atomic documentation files in `docs/chronicle/`.
Captures architecture, domain model, decisions, conventions, and plans as they
surface through work. View via `/chronicle`.

### Notebook (skill)

Convention system for atomic, Obsidian-compatible notes with YAML frontmatter and
wikilinks. Tells the agent how to create, link, and organise notes in a knowledge
base. Works standalone or alongside scribe (traces become graph nodes). When the
`obsidian` CLI is available, prefers it over raw filesystem operations for search,
backlinks, frontmatter, and vault hygiene (orphans, dead ends, unresolved links).

### QMD (skill)

Semantic search over markdown vaults using [qmd](https://github.com/tobi/qmd).
Hybrid BM25 + vector search with local models (no API calls). Teaches the agent
to manage collections, run queries (keyword, vector, or hybrid with reranking),
and keep the index fresh. Composes with notebook — replaces grep with semantic
search in the "search before create" step.

Requires `qmd` CLI installed separately.

### Reflection (skill)

Metacognition across accumulated session traces. Reads unreflected traces and
synthesises patterns, recurring themes, and open questions. Invoke with `/reflect`.
Benefits from both scribe (source material) and notebook (output destination).

## How They Compose

```
Scribe     — temporal record: what happened, session by session
Chronicle  — spatial record: what IS, the living state of the project
Notebook   — knowledge base: notes, ideas, linked thinking
QMD        — search: semantic retrieval across the knowledge base
Reflection — synthesis: patterns across all of the above
```

Each is independently useful. Together they form a full project memory system:
- Scribe + Chronicle = decision register (when/why + what)
- Scribe + Reflection = metacognitive loop
- Notebook + QMD = searchable knowledge base with semantic recall
- All five = self-documenting, self-reflecting project with full-text + vector search

## Package Structure

```
packages/
├── scribe/           # Extension: session traces
├── chronicle/        # Extension: auto-documentation
├── notebook/         # Skill + prompt: note-taking conventions
├── qmd/              # Skill: semantic search via qmd
└── reflection/       # Skill + prompt: cross-session synthesis
```

Each package follows pi's conventional directory layout (`extensions/`, `skills/`,
`prompts/`) and can be installed independently via `pi install <path>`.
