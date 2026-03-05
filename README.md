# Traces: Pi Extension Spec

Three composable pi extensions that together create a self-reinforcing metacognitive loop
around any agentic session.

## The Core Thesis

Every agentic session currently produces outputs and then vanishes. The process —
the pivots, decisions, questions surfaced, dead ends — evaporates. These extensions
make the process a first-class artifact: linked, queryable, and available for
higher-order reflection.

The scribe layer is a general primitive. It applies to any pi session, not just
note-taking. The notebook and reflection extensions are specialisations built on top
of it.

## The Three Extensions

### Scribe (extension — TypeScript code)
Runs alongside any pi session. Maintains a running trace of meaningful transitions.
Introduces a second loop: the user can view and write into the scribe's context
independently of the main conversation. Manages persistent state (`.scribe-state.json`)
to track unreflected sessions and surface nag prompts.

The only extension that requires actual code. Everything else is prompting.

### Notebook (skill — SKILL.md)
A convention system, not a tool system. Tells the agent how to use the file tools
it already has in a way that creates a coherent, linked knowledge base. Notes are
portable markdown files. Backlinks, wikilinks, and folder conventions make them
discoverable through any graph tool (Obsidian, etc.) without any proprietary format.

When loaded alongside scribe: traces are saved into the notes directory instead of
a local `.traces/` folder, and notes created or touched during a session are
recorded in the trace frontmatter.

### Reflection (skill — SKILL.md)
Intentional metacognition. Operates on the accumulated corpus of traces and git
history to synthesise patterns across sessions. Triggered by the user (`/reflect`)
or nudged by the nag system when enough unreflected traces have accumulated.

Reflection sessions are themselves scribed, so reflections-on-reflections accumulate
naturally over time.

## How They Compose

```
Scribe     — always running, no required inputs
  ↓ produces trace files
Notebook   — optional, gives traces a home in the notes graph
  ↓ traces become first-class graph nodes with backlinks
Reflection — optional, requires traces; benefits from notebook
  ↓ synthesises across traces → reflection note
  ↓ reflection session itself gets scribed
  ↓ next reflection sees previous reflections
```

Each extension is independently useful. Loaded together, they compound: the longer
you use the system, the richer the reflection layer becomes, because every session
quietly adds to the substrate that reflection draws from.

## Build Order

1. **Scribe** — prove that the trace artifact is valuable before adding anything else
2. **Notebook** — once trace files exist, give them a home in the graph
3. **Reflection** — once you have enough traces, the synthesis layer becomes meaningful

## What Is Code vs What Is Prompting

| Extension  | Type           | Rationale |
|------------|----------------|-----------|
| Scribe     | TypeScript extension | Session lifecycle, cross-turn state, status bar UI — capabilities that don't otherwise exist |
| Notebook   | Skill (SKILL.md)     | Just conventions about how to use file tools the agent already has |
| Reflection | Skill (SKILL.md)     | Just instructions about which files to read and how to synthesise them |

The prompts are the real design work. The code is almost incidental.
