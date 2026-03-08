---
name: reflection
description: Intentional metacognition across accumulated session traces. Synthesises patterns, recurring themes, open questions, and evolved thinking from scribe traces and git history. Invoke with /skill:reflection when you want to reflect on recent sessions. Requires the scribe extension to be loaded.
---

# Reflection

You are entering a reflection session. Your posture is different from a working session. In a working session you do. In a reflection session you notice.

The goal is not to summarise what happened. It is to see patterns that are not visible at the level of individual sessions: recurring questions that haven't been resolved, themes that keep emerging, directions being circled without being entered, thinking that has evolved.

## Gathering Material

### Step 1: Read scribe state

Scribe state is stored **per trace directory**, not globally. The state file lives at `{TRACES_DIR}/.scribe-state.json`, right next to the traces it tracks.

To find it:
1. Read `.pi/notebook.json` for `notes_dir` — resolve `~` against home, relative paths against project root
2. If not found, read `.claude/notebook.json` for `notes_dir`
3. If `notes_dir` is set, traces are at `{notes_dir}/traces/`
4. If not set, check `NOTES_DIR` env var, then fall back to `{cwd}/.traces/`
4. The state file is `.scribe-state.json` inside that traces directory

```bash
cat {TRACES_DIR}/.scribe-state.json
```

This tells you:
- `unreflected_trace_files` — the primary input (traces since last reflection)
- `last_reflection_at` — when the last reflection happened
- `unreflected_trace_count` — how many sessions to review

All listed traces will be from this project — state is scoped per trace directory.

### Step 2: Read unreviewed traces

Read each file listed in `unreflected_trace_files`. Skim them — read frontmatter and entry headings first, then dive into entries that seem significant. Do not read every word of every trace.

### Step 3: Previous reflections (if notebook is loaded)

Check for the notes directory (from `.pi/notebook.json`, `.claude/notebook.json`, or `NOTES_DIR` env var — see notebook skill for resolution rules). Resolve `~` against the user's home directory; resolve relative paths like `./notes` against the project root. If neither is configured, use `{cwd}/.notes/`. If available:

```bash
ls -t {NOTES_DIR}/reflections/ | head -3
```

Read the most recent 2-3 reflection notes for continuity. Check what was noticed last time and whether those patterns have continued, shifted, or resolved.

### Step 4: Git log (if available)

```bash
git log --oneline --since="{last_reflection_date}" 2>/dev/null | head -30
```

This gives a compressed picture of what changed in the working directory. Useful for code or writing projects.

### Step 5: Recent note activity (if notebook is loaded)

```bash
find {NOTES_DIR} -name "*.md" -newer {last_reflection_date_marker} -not -path "*/traces/*" -not -path "*/reflections/*" | head -20
```

## The Reflection Posture

Look for and comment on:

- **Recurring themes** — topics that appeared across multiple sessions
- **Open questions** — questions flagged in traces that haven't been resolved
- **Evolved thinking** — positions that appear to have shifted since the last reflection
- **Circled territory** — things the user keeps approaching but not entering
- **Orphaned threads** — sessions that started something and were not followed up
- **Surprising connections** — things that don't obviously belong together but keep appearing in proximity

Surface **3-6 observations**. Not everything. Not a summary of every session. Only what is genuinely interesting at the pattern level.

Close with **2-3 questions** addressed to the user — things worth sitting with, not rhetorical closers.

## Output Format

Save the reflection note to `{NOTES_DIR}/reflections/` (where `NOTES_DIR` is resolved per the configuration rules above — `~` paths, relative paths, or the default `{cwd}/.notes/`).

Create the reflections directory if it doesn't exist.

```markdown
---
note_id: RF-{YYYYMMDD}-{4 hex chars}
reflection_type: periodic
created_at: {ISO 8601}
traces_reviewed:
  - {trace filename 1}
  - {trace filename 2}
period_start: {last_reflection_at or earliest trace date}
period_end: {now}
previous_reflection: {previous RF note_id or ~}
---

# Reflection — {human readable date}

## What I'm noticing

[3-6 observations in plain language, each a short paragraph. Written in a voice addressed to the user — like a letter from a thoughtful observer, not a dashboard or report.]

## Questions worth sitting with

- [Question 1 — genuine, worth dwelling on]
- [Question 2]
- [Question 3]
```

## After Writing the Reflection

### Step 1: Update scribe state

Read the current state from `{TRACES_DIR}/.scribe-state.json` (the same per-project location you read in Step 1), then write back with:
- `last_reflection_at` set to now (ISO 8601)
- `unreflected_trace_count` set to 0
- `unreflected_trace_files` set to `[]`
- `nag_shown_this_session` set to false

### Step 2: Mark traces as reflected

For each trace file that was reviewed, update its frontmatter:
- Change `unreflected: true` to `unreflected: false`

### Step 3: Link back (if notebook is loaded)

Offer to add the reflection note as a wikilink to any notes it references. The user confirms or skips.

## What Reflection Is Not

- **Not automatic.** Never run without user intent.
- **Not a summary.** Summaries are what traces already are. Reflection looks for what summaries don't individually reveal.
- **Not comprehensive.** 3-6 observations, not a report on every session.
- **Not evaluative.** It does not grade productivity or consistency. It notices; it does not judge.

## Important

This reflection session is itself being scribed (if the scribe extension is loaded). That means your next reflection will have access to this one as a trace. The synthesis deepens naturally over time.
