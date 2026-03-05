# Reflection Skill Spec

## What It Is

A pi skill (SKILL.md). Purely prompting — it instructs the agent to read traces
and available history, synthesise patterns across them, and save the result as a
reflection note. Uses bash (git log), file read tools, and file write tools that
pi already has. No custom tooling required.

---

## Philosophy

Reflection is intentional metacognition. It is not automatic. The user invokes it
deliberately (`/reflect`), possibly prompted by the nag from scribe's unreflected
count. The act of choosing to reflect is part of the value.

The goal of a reflection session is not to summarise what happened. It is to see
patterns that are not visible at the level of individual sessions: recurring questions
that haven't been resolved, themes that keep emerging, directions that are being
circled without being entered, thinking that has evolved since the last reflection.

The reflection skill asks the agent to hold a different posture than in a working
session. In a working session, the agent does. In a reflection session, the agent
notices.

Reflection sessions are themselves scribed (if scribe is loaded). Over time, you
accumulate not just session traces but reflection traces, and the next `/reflect`
has access to previous reflections. The synthesis deepens hierarchically without
any extra design.

---

## Trigger

**Manual:** the user types `/reflect`

**Nudged:** the scribe's nag system surfaces a suggestion in the main conversation
when `unreflected_trace_count >= nag_threshold`. The user can ignore it or act on it.
The nag reads approximately:
> "You have 7 sessions since your last reflection on 28 Feb. Worth a `/reflect`
> when you have a moment."

---

## What Reflection Looks At

The skill instructs the agent to gather:

1. **Unreviewed trace files** — listed in `.scribe-state.json` under
   `unreflected_trace_files`. These are the primary input.

2. **Previous reflection notes** — if notebook is loaded, search `<NOTES_DIR>/reflections/`
   for the most recent 2-3 reflection notes to provide continuity.

3. **Git log** (if available) — `git log --oneline --since="<last_reflection_date>"`
   gives a compressed picture of what changed in the working directory since the
   last reflection. Useful for code or writing projects.

4. **Recent note activity** (if notebook is loaded) — files modified in `<NOTES_DIR>`
   since last reflection, via `find <NOTES_DIR> -newer <last_reflection_date_file> -name "*.md"`.

The agent does not read every file exhaustively. It reads trace summaries and
skims modified notes. Depth is added only where a pattern or question warrants it.

---

## The Reflection Posture

The skill instructs the agent to look for and comment on:

- **Recurring themes** — topics that appeared across multiple sessions
- **Open questions** — questions flagged in traces that haven't been resolved
- **Evolved thinking** — positions that appear to have shifted since the last reflection
- **Circled territory** — things the user keeps approaching but not entering
- **Orphaned threads** — sessions that started something and were not followed up
- **Surprising connections** — things that don't obviously belong together but
  keep appearing in proximity

The agent should surface 3-6 observations. Not everything. Not a summary of every
session. Only what is genuinely interesting at the pattern level.

It should close with 2-3 questions addressed to the user — things worth sitting
with, not rhetorical closers.

---

## Output: Reflection Note Format

Saved to `<NOTES_DIR>/reflections/<date>-<slug>.md` (with notebook) or
`.traces/reflections/<date>-<slug>.md` (scribe only).

```markdown
---
note_id: RF-20260305-a1b2
reflection_type: periodic
created_at: 2026-03-05T14:00:00Z
traces_reviewed:
  - 01JXYZ1234....md
  - 01JXYZ5678....md
  - ...
period_start: 2026-02-28T14:00:00Z
period_end: 2026-03-05T14:00:00Z
previous_reflection: RF-20260228-c3d4
---

# Reflection — 5 March 2026

## What I'm noticing

[3-6 observations in plain language, each a short paragraph]

## Questions worth sitting with

- [Question 1]
- [Question 2]
- [Question 3]
```

The reflection note is written in a voice addressed to the user, not a report.
It should feel like a letter from a thoughtful observer of your work, not a dashboard.

---

## After Reflection

When the reflection note is saved, the skill instructs the agent to:

1. Reset the unreflected count in `.scribe-state.json`:
   - Set `last_reflection_at` to now
   - Clear `unreflected_trace_count` to 0
   - Clear `unreflected_trace_files` to []
   - Mark reflected traces by updating their frontmatter: `unreflected: false`

2. Offer to add the reflection note as a wikilink to any notes it references
   (if notebook is loaded). The user confirms or skips.

---

## Synergy with Scribe + Notebook

**With scribe only:** reflection reads local trace files, writes a reflection
file, resets scribe-state. Useful.

**With scribe + notebook:** reflection notes are first-class vault nodes. They
appear in the graph. Notes referenced in a reflection gain the reflection as a
backlink. Previous reflections are searched and linked via `previous_reflection`.
The reflection itself gets traced by scribe — so the next reflection will have
access to this one as a trace entry.

**The hierarchy that emerges:**
```
Session traces (what happened in a session)
  → Reflection notes (patterns across sessions)
    → Reflection traces (what happened in a reflection session)
      → Meta-reflection (patterns across reflections)
        → ...
```

Each level is the same mechanism — scribe + reflection — applied to the outputs
of the level below. No extra design needed.

---

## What Reflection Is Not

- Not automatic. Never runs without user intent.
- Not a summary. Summaries are what traces already are. Reflection looks for
  what the summaries don't individually reveal.
- Not comprehensive. 3-6 observations, not a report on every session.
- Not evaluative. It does not grade the user's productivity or consistency.
  It notices; it does not judge.
