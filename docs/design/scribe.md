# Scribe Extension Spec

## What It Is

A pi extension (TypeScript) that runs alongside any pi session. It introduces a
second loop — the scribe loop — running in parallel with the main conversation loop.
The scribe loop maintains a running human-readable record of the session: what
happened, what was decided, what questions surfaced, where things might go next.

The scribe is a general primitive. It does not know or care whether the main session
is a coding session, a note-taking session, or anything else.

---

## The Dual Loop

Most agentic sessions have one loop: user ↔ agent. The scribe introduces a second:

```
Main loop:    user ↔ working agent
                         ↕ (agent writes entries at transitions)
Scribe loop:  trace file ↔ user (view + write at any time)
```

The two loops share one surface: the trace file. The working agent writes to it.
The user can read from it (via the overlay) and write into it (injecting notes,
corrections, or directions into the scribe's context). Whatever the user writes
into the scribe is picked up by the context injection on the next agent turn and
becomes visible to the working agent.

This means there is no separate "scribe agent" — the trace file IS the scribe's
context, and the working agent plays both roles depending on which file it's
addressing.

---

## The Overlay UX

The overlay is a togglable panel (pi-tui) showing the current trace file contents.

**Toggling:** a keybinding (e.g. `Ctrl+T`) or the command `/scribe` opens and
closes the overlay. It does not interrupt the main conversation.

**What it shows:**
- The running trace entries in chronological order
- Any pending suggestions the agent has written (notes it thinks would be useful
  to surface, questions it's flagged, directions it's noticed the session might go)
- The session metadata (started at, working dir, unreflected count)

**Writing into it:** the overlay is not read-only. The user can type into it
directly. Anything added to the trace file this way is a scribe entry from the
user's perspective — it gets picked up on the next context injection and the
working agent sees it. This is how the user pushes information into the scribe:
not by saying it in the main conversation, but by writing it in the trace layer.

Use cases for writing into the scribe:
- Tagging the current session with a theme you've identified
- Correcting the agent's interpretation of what the session is about
- Adding a note you don't want to say out loud in the main conversation
- Flagging something as important for the next reflection

**Status bar (always visible, overlay closed):**
```
[scribe: 6 entries | 4 sessions unreflected]
```

---

## Trace File Format

One file per session. Saved as markdown with YAML frontmatter.

**Path (scribe only):** `.traces/<ulid>.md` in the working directory
**Path (with notebook):** `<NOTES_DIR>/traces/<ulid>.md`

```markdown
---
session_id: 01JXYZ1234ABCDEF
started_at: 2026-03-05T09:14:00Z
ended_at: ~
working_dir: /home/sprite/myproject
unreflected: true
tags: []
notes_created: []
notes_touched: []
files_modified: []
---

# Session trace — 2026-03-05

## 09:14 — Session started
Working in /home/sprite/myproject. Loaded: scribe, notebook.

## 09:22 — Direction established
User is exploring the scribe extension architecture. Focus: how the dual loop works
in practice, specifically whether the trace file needs its own agent or whether the
working agent writes it.

## 09:31 — Decision
Decided against a separate scribe agent. The working agent writes the trace file
directly. The trace file is the context; no extra moving parts needed.

## 09:38 — Open question [user]
> Is the overlay read-only or can I write into it directly?

## 09:39 — Suggestion [agent]
Note N-c9ce7149 (Traces as first-class knowledge artifacts) is relevant here and
would be useful to surface. Not shown in main conversation unless user opens overlay.

## 09:44 — Session end
Concluded: dual loop via shared trace file. One open question remains (see 09:38).
Three entries flagged for follow-up.
```

**Entry types:**
- Transition entries: written by the agent at meaningful moments
- User entries: written directly by the user into the overlay
- Suggestion entries: agent proposals (notes to surface, directions to consider) —
  visible in overlay only, not surfaced in main conversation unless user acts on them
- Open question entries: questions the agent has flagged for later

---

## When the Agent Writes Entries

The agent writes a trace entry when it detects a **transition**, not on every turn:

- Session start (always)
- A file is opened, created, or significantly modified
- The topic or direction of the session shifts
- A decision is made or a direction is established
- A question surfaces that isn't immediately answered
- The agent notices something it wants to suggest (note, connection, direction)
- Session end (always — summary entry)

The agent does NOT write an entry for every message. Stable periods where the
conversation is developing a single thread get collapsed. The trace should read
like a narrative, not a log.

The agent is instructed to keep entries brief: one to three sentences. The entry
is a label, not a transcript.

---

## .scribe-state.json

Persists cross-session state. Lives at `~/.config/pi/scribe-state.json` or
in the working directory if no config path is set.

```json
{
  "last_reflection_at": "2026-02-28T14:00:00Z",
  "unreflected_trace_count": 7,
  "unreflected_trace_files": [
    "/home/sprite/project/.traces/01JX....md",
    "..."
  ],
  "nag_threshold": 5,
  "nag_shown_this_session": false
}
```

**Updated:** at session end (increment `unreflected_trace_count`, append file path).
**Reset:** when reflection skill runs (`/reflect`) — sets `last_reflection_at` to now,
clears `unreflected_trace_count` and `unreflected_trace_files`.

---

## Nag System

At session start, the extension reads `.scribe-state.json`. If
`unreflected_trace_count >= nag_threshold`:

1. Injects into the system prompt:
   > "Note: there are {N} sessions since your last reflection on {date}. If the
   > user has a moment, suggest `/reflect` — they may not know this is available."
2. Shows in status bar: `[scribe: N sessions unreflected]`
3. Sets `nag_shown_this_session: true` so it doesn't re-nag mid-session

The nag is a suggestion to the agent, not a forced interruption. The agent chooses
when and whether to surface it in the main conversation. The status bar always
shows it regardless.

---

## System Prompt Injection

The extension injects into the system prompt at session start:

```
You have the scribe extension loaded. A trace file for this session is at:
{trace_file_path}

At meaningful transitions — direction changes, decisions, open questions, file
modifications, suggestions you want to surface — write a brief entry to this file
using the file write tools. Keep entries to 1-3 sentences. Do not write an entry
for every message; only when something meaningfully changes.

You may also write suggestion entries to the trace file when you notice something
that would be useful to the user but does not need to interrupt the main
conversation (e.g., a relevant note, a direction worth exploring, a connection
you've noticed). These are visible in the scribe overlay and the user can act on
them when they choose to look.

The user can write into the trace file directly via the scribe overlay. If you
notice new user-written entries in the trace file at the start of a turn, acknowledge
and respond to them appropriately.
```

---

## Extension Hooks (TypeScript)

```typescript
onSessionStart(ctx: SessionContext): void
  // Create trace file with frontmatter
  // Read .scribe-state.json, evaluate nag condition
  // Inject trace file path and scribe instructions into system prompt
  // Start status bar rendering

onContextBuild(ctx: TurnContext): void
  // Read trace file, check for new user-written entries since last turn
  // Inject brief summary of trace so far into context if session > 10 turns
  // (prevents context blindness in long sessions)

onSessionEnd(ctx: SessionContext): void
  // Finalize trace file (set ended_at, collect files_modified from git status)
  // Update .scribe-state.json (increment unreflected count, append file path)
  // Update status bar final state
```

---

## What Scribe Does Not Do

- Does not summarise between turns (too expensive, too noisy)
- Does not automatically link to notes (that is notebook's concern)
- Does not analyse patterns across sessions (that is reflection's concern)
- Does not force entries — the agent decides when a transition is meaningful
- Does not block or interrupt the main conversation for any reason
