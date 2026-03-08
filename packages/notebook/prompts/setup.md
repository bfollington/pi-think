---
description: Configure pi-think — set up where notes, traces, and breadcrumbs are stored
---

Walk me through setting up pi-think for this project.

## Process

### 1. Check current state

Look at what's already configured:

```bash
# Existing config
cat .pi/notebook.json 2>/dev/null || echo "No config yet"

# What packages are installed
ls .pi/skills/ .pi/extensions/ .pi/prompts/ 2>/dev/null

# Obsidian CLI available?
command -v obsidian >/dev/null && echo "obsidian cli: yes" || echo "obsidian cli: no"

# qmd available?
command -v qmd >/dev/null && echo "qmd cli: yes" || echo "qmd cli: no"
```

Report what you find before asking questions.

### 2. Notes directory

This is the most important choice — it determines where notes, traces, breadcrumbs, and reflections all live.

Ask the user:

**Where should your notes live?**

| Option | Value | When to use |
|---|---|---|
| **Shared vault** | `"~/notes"` | You have one knowledge base across all projects (Obsidian vault, etc.) |
| **Project-local** | `"./notes"` | Notes are specific to this project |
| **Custom path** | `"~/obsidian/my-vault"` | You have an existing vault elsewhere |

Explain the implications:
- **Shared vault**: Traces from this project appear in your main vault's graph. Breadcrumbs and reflections are visible alongside all your other notes. Cross-project connections are natural.
- **Project-local**: Notes stay contained. Good for project-specific documentation or if you don't use a shared vault. The `.traces/` directory is gitignored by default.

If they already have an Obsidian vault and the CLI is available, run `obsidian vaults verbose` and offer to point at an existing vault.

### 3. Obsidian vault name (if applicable)

If `notes_dir` points to an Obsidian vault directory, ask for the vault name or auto-detect it:

```bash
obsidian vaults verbose 2>/dev/null
```

Match the resolved `notes_dir` path against known vault paths. If found, set `vault` in the config.

### 4. Scribe model (optional)

The scribe extension runs a sideband LLM call to generate trace entries. By default it uses `anthropic/claude-haiku-4-5` — fast and cheap.

Ask: **Happy with the default scribe model, or want to change it?**

Options:
- `anthropic/claude-haiku-4-5` (default — fast, cheap)
- Any other model the user prefers

Only ask this if the scribe extension is installed. Most users should keep the default.

### 5. Create directory structure

Once choices are confirmed, create the config and directories:

```bash
# Ensure .pi/ exists
mkdir -p .pi

# Write config
cat > .pi/notebook.json << 'EOF'
{
  "notes_dir": "<chosen value>"
}
EOF
```

If vault name was detected, include it:
```json
{
  "notes_dir": "<chosen value>",
  "vault": "<vault name>"
}
```

Create the subdirectories in the resolved notes path:

```bash
mkdir -p {NOTES_DIR}/inbox
mkdir -p {NOTES_DIR}/working
mkdir -p {NOTES_DIR}/permanent
mkdir -p {NOTES_DIR}/archive
mkdir -p {NOTES_DIR}/breadcrumbs
mkdir -p {NOTES_DIR}/reflections
mkdir -p {NOTES_DIR}/traces
```

### 6. Check for existing content

If the notes directory already has content:

```bash
find {NOTES_DIR} -name "*.md" -not -path "*/traces/*" | head -5
```

Report what's there. Don't reorganise anything — just acknowledge it.

If there's a `.scribe-state.json` in the traces directory, report the unreflected count.

### 7. Summary

Show the user what was configured:

```
✓ Notes directory: ~/notes (shared vault)
✓ Vault: my-vault (obsidian CLI available)
✓ Scribe model: anthropic/claude-haiku-4-5

Directory structure:
  ~/notes/
  ├── inbox/          ← new captures land here
  ├── working/        ← notes being developed
  ├── permanent/      ← settled knowledge
  ├── archive/        ← retired notes
  ├── breadcrumbs/    ← thinking-state snapshots (/crumb)
  ├── reflections/    ← cross-session synthesis (/reflect)
  └── traces/         ← session records (automatic via scribe)

Available commands:
  /capture    — quick note capture
  /crumb      — drop a breadcrumb
  /recent     — headspace briefing
  /reflect    — reflection session
  /setup      — re-run this setup
```

### 8. Offer first steps

After setup, offer:
- "Want to capture something? (`/capture`)"
- "Want a briefing on what's already here? (`/recent`)"
- "All set — just start working and scribe will record traces automatically."
