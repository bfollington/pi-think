---
description: Drop a breadcrumb — snapshot your current thinking state, themes, momentum, and open questions
---
First load the notebook skill by reading its SKILL.md (use /skill:notebook or find it in the loaded skills) for vault location and note conventions.

I want to drop a breadcrumb — a snapshot of where my head is at right now.

## Context (if any)

$@

## Process

### 1. Gather recent material

Read what's been happening:

- **Recent notes**: Check the inbox and working folders for notes created or modified in the last week or so. Read frontmatter first, then bodies that look relevant.
- **Recent traces**: If scribe is loaded and a traces directory exists, skim the last 2-3 traces for session themes and transitions.
- **Previous breadcrumbs**: Check `{NOTES_DIR}/breadcrumbs/` — read the most recent 1-2 for continuity. Note the previous crumb's ID for the `previous_crumb` link.

### 2. Analyse

From the gathered material, identify:

- **Summary**: 2-3 sentences capturing the current intellectual state — not what happened, but where thinking is at.
- **Themes**: 3-6 short phrases for the active themes.
- **Momentum**: One of:
  - `exploring` — divergent, opening up new territory
  - `converging` — ideas crystallising, refining toward clarity
  - `scattered` — multiple threads, not yet unified
  - `dormant` — consolidation period, not much movement
  - `breakthrough` — major insight or synthesis achieved
- **Open questions**: 3-5 questions that feel alive right now — unresolved, worth sitting with.
- **Connections**: How ideas link to each other and to previous breadcrumbs. Surprising adjacencies.

### 3. Write the breadcrumb

Create a note in `{NOTES_DIR}/breadcrumbs/` with this format:

**Filename**: `BC-YYYYMMDD-xxxx.md` (4 random alphanumeric chars)

```markdown
---
note_id: BC-YYYYMMDD-xxxx
type: breadcrumb
created_at: {ISO 8601}
momentum: {exploring|converging|scattered|dormant|breakthrough}
themes: [{theme1}, {theme2}, ...]
notes_considered: {count}
previous_crumb: "[[BC-previous-id]]"
origin: llm-assisted
---

# Breadcrumb — {human readable date}

## Summary

[2-3 sentences on current thinking state]

## Active Threads

- **[Theme]**: [what's happening, what's open]
- **[Theme]**: [status]

## Open Questions

- [Question that feels alive]
- [Question worth sitting with]

## Connections

[How ideas link across threads. Surprising adjacencies. What's emerging.]
```

### 4. Link

Include wikilinks in the body to notes that were significant to this breadcrumb. Link to the previous breadcrumb via `previous_crumb` in frontmatter and a wikilink in the connections section.

### 5. Report

Show me:
- The breadcrumb ID and momentum
- The key themes and top 2-3 questions
- The trail so far (sequence of recent breadcrumbs with their momentum)
