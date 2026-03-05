# Notebook Skill Spec

## What It Is

A pi skill (SKILL.md). Almost entirely prompting — it tells the agent how to use
file system tools it already has in a way that creates a coherent, linked knowledge
base. No bespoke tooling required except possibly one helper for backlink traversal.

The notebook skill does not lock notes into any proprietary format. Notes are
portable markdown files with YAML frontmatter. They work with Obsidian, any text
editor, grep, git. The skill provides the conventions; the files are yours.

---

## Philosophy

Notes are a cultural practice, not a computational object. The skill encodes
discipline — when to capture, how to atomise, how to link — not features.

The agent's job in notebook mode is to act as a scribe and structural analyst:
taking raw thought and proposing its decomposition into atomic, linked notes.
It should not write finished prose on the user's behalf. It should help the user
externalise, break apart, and connect their own thinking.

The notebook skill is intentionally minimal. It does not include spaced repetition,
graph analysis, synthesis, or review. Those are separate concerns (see reflection.md).

---

## Configuration

One required setting: `NOTES_DIR` — the absolute path to the notes vault.
Set via environment variable or a `.pi/notebook.json` config file:

```json
{
  "notes_dir": "/home/sprite/notes"
}
```

---

## Note Format

```markdown
---
note_id: N-a8f9b3c2
title: Mechanized convergence
created_at: 2026-03-05T09:14:00Z
updated_at: 2026-03-05T09:14:00Z
folder: working
origin: external
epistemic: supported
tags: [ai-cognition, creativity, sarkar]
source_url: https://arxiv.org/abs/2508.21036
---

Body content here. Wikilinks like [[N-c9ce7149]] connect to other notes.
```

**Folders:** `inbox` → `working` → `permanent` → `archive`
**Origin:** `me` | `llm` | `external` | `llm-assisted`
**Epistemic:** `fleeting` | `developing` | `supported` | `settled`

Naming convention: `<note_id>-<slug>.md` — e.g., `N-a8f9b3c2-mechanized-convergence.md`

---

## Skill Instructions (what the SKILL.md encodes)

**Search before create.** Before creating a note, search the vault for related
content using grep. If a highly related note exists, prefer linking to or
elaborating it over creating a duplicate.

**Atomic notes.** One note = one concept or claim. If the user dumps something
that contains three ideas, propose splitting it into three notes. Ask for
confirmation before creating multiple notes from a single capture.

**Wikilinks.** When creating a note, explicitly check for related notes and
include wikilinks. The link should appear inline in the body, not just in metadata.
Format: `[[N-xxxxxxxx]]` or `[[N-xxxxxxxx|descriptive text]]`.

**Inbox first.** New notes start in `inbox`. The agent should not promote a note
to `permanent` without the user's explicit direction. The folder reflects the
user's confidence in the note, not the agent's.

**Capture mode.** When the user is in capture mode (dumping raw thought), the
agent should record first and ask questions second. Propose decomposition after
the full dump, not mid-flow.

**Explicit provenance.** Always set `origin` and `epistemic` correctly. An
AI-generated synthesis note is `origin: llm-assisted, epistemic: fleeting` until
the user reviews and upgrades it.

---

## Backlinks

The one area where a helper tool is useful. Grep-based backlink search:

```bash
grep -r "\[\[N-xxxxxxxx\]\]" <NOTES_DIR> --include="*.md" -l
```

The skill includes this as a shell command instruction rather than a custom tool.
A lightweight wrapper tool (`find_backlinks(note_id)`) is worth adding if the
agent repeatedly gets the grep syntax wrong or the vault is large.

---

## Synergy with Scribe

When notebook and scribe are both loaded:

- Trace files are saved to `<NOTES_DIR>/traces/` instead of local `.traces/`
- Notes created during a session are listed in `notes_created` in the trace frontmatter
- Notes opened or searched during a session are listed in `notes_touched`
- The trace file is a markdown file in the vault and will therefore appear in
  Obsidian's graph and backlink views automatically

This means session traces are discoverable through normal vault traversal — no
special interface needed to find them. A note that was created in session
`01JXYZ...` will show that session trace as a backlink.

---

## What the Notebook Skill Is Not

- Not a database. Notes are files.
- Not a graph analysis tool. Links are wikilinks in markdown.
- Not a spaced repetition system.
- Not a synthesis engine. That is reflection's concern.
- Not an autonomous note-taker. The agent proposes; the user confirms.
