---
description: Headspace briefing — review recent activity and orient on what's alive
---
First, load the notebook skill for vault location and note conventions. In pi use `/skill:notebook`; in Claude Code use `/notebook:notebook` or read the SKILL.md directly.

Get me back in the loop. I want a briefing on what I've been doing and where the interesting threads are.

## Focus (if any)

$@

## Process

### 1. Detect available tools

Before gathering material, check what search tools are available:

```bash
command -v obsidian >/dev/null && echo "obsidian cli available" || echo "obsidian not found"
command -v qmd >/dev/null && echo "qmd available" || echo "qmd not found"
```

If obsidian CLI is available, detect the vault name (check config or run `obsidian vaults verbose`). If qmd is available, check `qmd collection list` for an indexed collection covering the vault.

### 2. Gather recent material

Check each of these, adapting to what's available. Prefer richer tools when present:

**Notes** (required — this is the core):

If a focus topic was provided and **qmd** is available:
```bash
qmd query "{focus topic}" -n 10 --files
```

If a focus topic was provided and **obsidian CLI** is available:
```bash
obsidian search query="{focus topic}" vault=<name>
```

Otherwise, fall back to filesystem listing:
```bash
find {NOTES_DIR}/inbox -name "*.md" -mtime -14 | head -20
find {NOTES_DIR}/working -name "*.md" -mtime -14 | head -20
```

**Breadcrumbs** (if `breadcrumbs/` exists):
```bash
ls -t {NOTES_DIR}/breadcrumbs/ | head -5
```

**Traces** (if scribe is loaded and `traces/` exists):
```bash
ls -t {NOTES_DIR}/traces/ | head -5
```

**Reflections** (if `reflections/` exists):
```bash
ls -t {NOTES_DIR}/reflections/ | head -3
```

Read frontmatter and headings first. Dive into bodies only for items that seem significant.

If arguments were provided, use them to filter (a time window like "week" or "month", or a topic to focus on). When a topic is given, use qmd or obsidian search to find thematically related notes rather than just listing by date.

### 3. Analyse the landscape

From the gathered material, identify:

- **Active threads**: Topics/themes appearing across multiple recent notes. What's being actively developed?
- **Breadcrumb trail**: What do recent breadcrumbs say about momentum and direction? (If no breadcrumbs exist, note that and suggest `/crumb`.)
- **Trace themes**: What kinds of sessions have been happening? Building, exploring, refactoring, writing?
- **Open questions**: Collect unresolved questions from breadcrumbs, notes, and reflections. Which feel most alive?
- **Quiet areas**: Themes that used to appear but have gone silent.

### 4. Present the briefing

```markdown
# Headspace Briefing
Generated: {timestamp}
Window: {date range of material reviewed}

## Where You've Been
[2-3 sentences summarising the dominant themes and activities]

## Active Threads
- **[Theme 1]**: [brief status — what's happening, what's open]
- **[Theme 2]**: [brief status]
- **[Theme 3]**: [brief status]

## Breadcrumb Trail
[List last 2-3 breadcrumbs with their momentum and key insight.
If no breadcrumbs exist: "No breadcrumbs yet — try `/crumb` to start tracking your thinking state."]

## Live Questions
Questions that feel most active or interesting right now:
1. [question from recent material]
2. [question]
3. [question]

## Entry Points
If you want to pick up where you left off:
- **Continue exploring**: [suggestion based on recent exploring/divergent work]
- **Push toward completion**: [suggestion for converging/finishing something]
- **Start fresh**: [suggestion for a quiet area or new thread]
```

### 5. Offer follow-ups

After the briefing, offer:
- "Want me to expand on any thread?"
- "Want to pull up the full notes for [specific topic]?"
- "Ready to capture new thinking? (`/capture`)"
- "Want to drop a breadcrumb? (`/crumb`)"

## Philosophy

- **Orientation, not summary**: Help me find my way back, not exhaustively recap everything.
- **Questions over answers**: Surfacing open questions is more valuable than summarising closed ones.
- **Momentum matters**: Knowing whether I'm exploring vs converging changes how I approach the session.
- **Multiple entry points**: Different days call for different modes — offer options.
