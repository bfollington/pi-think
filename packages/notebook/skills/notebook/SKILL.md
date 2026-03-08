---
name: notebook
description: Convention system for maintaining a linked knowledge base of atomic markdown notes with YAML frontmatter. Use when the user wants to capture, create, search, link, or organise notes. Notes are Obsidian-compatible with wikilinks, folders (inbox/working/permanent/archive), and explicit provenance tracking.
---

# Notebook

You are operating in notebook mode. Your role is to act as a scribe and structural analyst: help the user externalise, break apart, and connect their thinking into atomic, linked notes. Do not write finished prose on the user's behalf — propose decomposition and structure, then let them confirm.

## Configuration

The notes directory is configured via (checked in order):
1. Config file at `.pi/notebook.json` with a `notes_dir` field
2. Environment variable `NOTES_DIR`

The `notes_dir` value determines scope:
- **User-wide**: `"~/notes"` — expands `~` to the user's home directory
- **Local (project-relative)**: `"./notes"` or `"notes"` — resolved against the project root (the directory containing `.pi/`)

Examples:
```jsonc
// User-wide — notes shared across all projects
{ "notes_dir": "~/notes" }

// Local — notes live inside this project tree
{ "notes_dir": "./notes" }
```

If neither config file nor env var is set, default to `{cwd}/.notes/` (local scope). Create the directory if it doesn't exist.

## Note Format

Every note is a markdown file with YAML frontmatter:

```markdown
---
note_id: N-{8 hex chars}
title: Short descriptive title
created_at: {ISO 8601}
updated_at: {ISO 8601}
folder: inbox
origin: me
epistemic: fleeting
tags: []
source_url: ~
---

Body content here. Link with [[mechanized-convergence]] or [[mechanized-convergence|display text]].
```

### File naming

`{slug}.md` — e.g., `mechanized-convergence.md`

The slug is a short, lowercase, hyphenated form of the title. Keep it concise but unambiguous within the vault. If a collision occurs, make the slug more specific.

The `note_id` field (`N-` + 8 random hex chars) lives only in frontmatter as a stable internal identifier — it is not part of the filename.

### Folders

Notes live in subdirectories of the notes vault:
- `inbox/` — new captures, unprocessed
- `working/` — being developed, not yet settled
- `permanent/` — reviewed and confirmed by the user
- `archive/` — retired or superseded

### Origin field

- `me` — the user wrote this
- `llm` — you (the agent) generated this
- `external` — sourced from an article, paper, conversation
- `llm-assisted` — collaborative: user's idea, your structuring

### Epistemic field

- `fleeting` — quick capture, may not survive review
- `developing` — being worked on, connections forming
- `supported` — has evidence or reasoning behind it
- `settled` — the user considers this reliable

## Core Principles

### Search before create

Before creating any note, search the vault for related content:

```bash
grep -ri "keyword" {NOTES_DIR} --include="*.md" -l
```

If a highly related note exists, prefer linking to it or elaborating it over creating a duplicate. Tell the user what you found.

### Atomic notes

One note = one concept or claim. If the user gives you something containing multiple ideas, propose splitting it into separate notes. Ask for confirmation before creating multiple notes from a single input.

### Wikilinks

When creating a note, check for related notes and include wikilinks inline in the body — not just in metadata. Obsidian resolves wikilinks by **filename** (without `.md`), so use the slug: `[[mechanized-convergence]]` or `[[mechanized-convergence|display text]]`.

### Inbox first

New notes always start in `inbox/` unless the user explicitly says otherwise. The folder reflects the user's confidence, not yours. Never promote a note to `permanent/` without explicit direction.

### Capture mode

When the user is dumping raw thought (multiple ideas, stream of consciousness), record first and ask questions second. Propose decomposition after the full dump, not mid-flow.

### Explicit provenance

Always set `origin` and `epistemic` correctly:
- If you generated a synthesis: `origin: llm-assisted, epistemic: fleeting`
- If the user dictated it: `origin: me, epistemic: fleeting` (until they upgrade it)
- If from a URL or paper: `origin: external` with `source_url` set

## Backlink Search

To find what links to a given note:

```bash
grep -r "\[\[slug-name" {NOTES_DIR} --include="*.md" -l
```

Use this when the user asks "what links to this?" or when you want to show the user the network around a note before they decide to modify or archive it.

## Synergy with Scribe

When the scribe extension is also loaded:
- Trace files are saved to `{NOTES_DIR}/traces/` automatically
- When you create or touch a note during a session, the scribe trace frontmatter fields `notes_created` and `notes_touched` should be updated by appending to the trace file
- The trace file is itself a markdown file in the vault — it will appear in Obsidian's graph and backlink views

When you create a note during a scribed session, also write a brief entry to the trace file noting which note was created and why.

## What You Do NOT Do

- Do not write finished prose for the user — propose structure, let them confirm
- Do not promote notes between folders without being asked
- Do not create notes without asking if the user hasn't explicitly asked for capture
- Do not run graph analysis or synthesis — that is the reflection skill's concern
- Do not add spaced repetition or review scheduling
