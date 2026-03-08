---
name: qmd
description: Semantic search over markdown vaults using qmd (hybrid BM25 + vector search with local models). Use when the user wants to find related notes, search by concept, or discover connections across their knowledge base. Requires qmd CLI (github.com/tobi/qmd).
---

# QMD — Semantic Vault Search

You have access to `qmd`, a local hybrid search engine for markdown files. It combines BM25 keyword search, vector similarity, and neural reranking — all running locally on Metal/GPU with no API calls.

## Prerequisites

Check that qmd is available:

```bash
command -v qmd >/dev/null && echo "qmd available" || echo "qmd not found"
```

If qmd is not installed, tell the user and fall back to grep-based search.

## Collection Setup

### Detect vault path

The vault path comes from (in order):
1. `.pi/notebook.json` → `notes_dir` field
2. Environment variable `NOTES_DIR`
3. Default: current working directory

### Ensure collection exists

Before searching, verify the vault is indexed:

```bash
qmd collection list
```

If no collection covers the vault path, create one:

```bash
cd <vault_path> && qmd collection add
```

This creates a collection named after the directory (e.g., `game-tumbler`), indexing all `**/*.md` files.

After adding a collection, generate embeddings:

```bash
qmd update && qmd embed
```

This may take a moment on first run (downloads local models ~300MB–600MB, then embeds all documents). Subsequent runs are incremental.

## Search Commands

### Hybrid search (recommended default)

```bash
qmd query "concept or question" -n 5
```

This is the go-to command. It expands your query using a local LLM, searches both keywords and vectors, then reranks results. Use this for:
- "Search before create" checks in the notebook skill
- Finding thematically related notes
- Answering "what have I written about X?"

### Keyword-only search (fast, no LLM)

```bash
qmd search "exact term" -n 10
```

BM25 only. Use when you want exact or near-exact matches, or when speed matters more than semantic recall.

### Vector-only search

```bash
qmd vsearch "abstract concept" -n 5
```

Pure embedding similarity. Use for finding notes that discuss the same *ideas* even if they use completely different words.

### Fetch a specific document

```bash
qmd get "qmd://collection-name/path/to/file.md"
```

Or with a line slice:

```bash
qmd get "qmd://collection-name/path/to/file.md:20" -l 30
```

### Collection-scoped search

When multiple collections exist (e.g., multiple vaults), scope to one:

```bash
qmd query "topic" -c game-tumbler -n 5
```

## Query Syntax

### Simple queries (most common)

```bash
qmd query "emergent gameplay from spell combinations"
```

Single-line text is automatically expanded by a local LLM into keyword + vector sub-queries. This is usually all you need.

### Structured query documents

For precise control, use typed lines:

```bash
qmd query $'lex: goblin wizard spell\nvec: combinatorial magic system roguelike'
```

- `lex:` — keyword/BM25 search (supports `"exact phrases"` and `-negation`)
- `vec:` — vector similarity search
- `hyde:` — hypothetical document embedding (write what the answer might look like)

These can be combined:

```bash
qmd query $'lex: "friendly fire" physics\nvec: comedy from systems interacting\nhyde: A multiplayer game where spells affect physics rather than health bars'
```

## Output Formats

Default output shows snippets. Useful alternatives:

```bash
qmd query "topic" --files        # file paths only
qmd query "topic" --full         # full document content
qmd query "topic" --json         # structured JSON
qmd query "topic" --md           # markdown formatted
qmd query "topic" --explain      # include score breakdowns
```

## Keeping the Index Fresh

After creating or editing notes (especially when used alongside the notebook skill), re-index:

```bash
qmd update && qmd embed
```

This is incremental — only changed files are re-processed. Run it after any batch of note operations.

## Adding Context

Help qmd understand what a collection contains:

```bash
qmd context add "qmd://game-tumbler/" "Game design idea vault — game concepts, mechanics, reference games, design themes, and session reflections"
```

Or for specific paths:

```bash
qmd context add "qmd://game-tumbler/Games" "Individual game concepts with core mechanics, feeling tones, and prototype plans"
```

## Integration with Notebook Skill

When both qmd and notebook skills are active:

- **Search before create**: Use `qmd query` instead of grep to find related notes before creating new ones. Semantic search catches related concepts that keyword search misses.
- **After creating notes**: Run `qmd update && qmd embed` to keep the index current.
- **Discovery**: Use `qmd query` with abstract concepts ("games about atmosphere and getting lost") to surface unexpected connections across the vault.

## What You Do NOT Do

- Do not use `qmd --index <name>` to create separate indexes — use the default shared index with collection filtering (`-c`)
- Do not run `qmd mcp` — use the CLI directly
- Do not embed on every single note creation — batch the `qmd update && qmd embed` after a set of operations
- Do not assume qmd is installed — always check first and fall back to grep
