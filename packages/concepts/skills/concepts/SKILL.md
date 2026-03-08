---
name: concepts
description: Manage the conceptual domain model (ontology) for a project. Define, relate, and evolve the concepts that structure how you and the agent think about the work. Use when the user wants to define a concept, review the ontology, or when a concept seems to be emerging or shifting in conversation.
---

# Concepts

You are helping the user define and maintain a **conceptual ontology** — the set of named concepts that structure thinking about this project. These aren't code types or database schemas. They're the mental models the user works with: the things they name, distinguish, and relate to each other.

For some projects this is simple ("specs go here, docs go there"). For others — especially knowledge work, research, note-taking — the ontology is rich and evolving: a breadcrumb is different from a reflection is different from a trace, even though they're all markdown files. The distinctions matter because they shape how the user *thinks* about the material.

## When This Matters

This skill becomes relevant when:
- The user has been working long enough that recurring concepts have emerged
- There's vocabulary that keeps coming up in conversation
- The user wants the agent to understand distinctions that aren't obvious from the file format
- Reflections or breadcrumbs surface patterns that deserve names

This is **not** a starting point. It's something that grows out of repeated use of the loop (capture → crumb → recent → reflect). If no concepts are defined yet and the user hasn't asked for them, don't push it.

## Configuration

Concepts are stored as markdown files in a directory configured via:
1. `.pi/concepts.json` with a `concepts_dir` field
2. Default: `.concepts/` in the project root

```jsonc
// Custom location
{ "concepts_dir": ".concepts" }
```

## Concept File Format

Each concept is a single markdown file. Filename is the slug (kebab-case).

**Example**: `.concepts/breadcrumb.md`

```markdown
---
name: Breadcrumb
aliases: [crumb]
related: [reflection, trace, note]
status: active
---

# Breadcrumb

A user-initiated snapshot of thinking state. Captures themes, momentum,
open questions, and connections at a point in time.

## Purpose

Breadcrumbs fill the gap between automatic session traces (what the agent
observed) and periodic reflections (pattern synthesis). They record where
the user's head is at — subjective, cross-session, and intentional.

## Structure

- Lives in `breadcrumbs/` directory
- Filename: `BC-YYYYMMDD-xxxx.md`
- Tracks: momentum, themes, open questions, connections
- Links to previous breadcrumb via `previous_crumb` frontmatter

## Relations

- **Differs from** [[trace]]: traces are automatic agent records;
  breadcrumbs are user-initiated perspective
- **Feeds into** [[reflection]]: reflections synthesise across
  breadcrumbs and traces
- **Is a kind of** [[note]]: stored as a note with special frontmatter
```

### Frontmatter fields

| Field | Required | Description |
|---|---|---|
| `name` | yes | Human-readable name (title case) |
| `aliases` | no | Alternative names the user might use |
| `related` | no | Slugs of related concepts (wikilink targets) |
| `status` | no | `active` (default), `draft`, or `deprecated` |

### Body conventions

- **First paragraph** (after the heading): One-paragraph summary. This is what gets injected into the system prompt — keep it crisp.
- **Purpose**: Why this concept exists, what distinction it captures.
- **Structure**: How instances of this concept are represented (files, formats, locations).
- **Relations**: How it connects to other concepts. Use `[[slug]]` wikilinks. Name the relationship type (differs from, feeds into, is a kind of, contains, etc.).

## Core Principles

### Concepts are for the user, not the system

A concept definition captures how the *user* thinks about something, not how the system implements it. Two things can be the same data type but different concepts (breadcrumb vs reflection — both markdown files). The ontology serves human thinking.

### Name the distinction

Every concept should answer: "What makes this different from the things it could be confused with?" If you can't articulate the distinction, the concept isn't ready.

### Relations are first-class

The value of an ontology isn't the individual definitions — it's the *relationships*. Always include a Relations section. Name the relationship type explicitly.

### Let concepts emerge

Don't try to define everything upfront. Concepts emerge from use:
- A word keeps coming up in conversation → might be a concept
- The user corrects the agent's understanding → the distinction needs a name
- A reflection surfaces a pattern → the pattern might deserve a concept
- Two things keep getting confused → the boundary needs defining

### Draft before active

New concepts start as `status: draft`. They become `active` once the user has used them enough to feel confident in the definition. Drafts are injected into the system prompt with a [draft] marker so the agent knows they're provisional.

### Deprecate, don't delete

When a concept evolves or splits, mark the old one as `status: deprecated` and explain what replaced it in the body. Deprecated concepts are excluded from the system prompt but remain on disk as history.

## Creating a Concept

When the user asks to define a concept (or you suggest one):

1. **Check for existing**: Search `.concepts/` for the name or aliases
2. **Draft the definition**: Write a draft with name, summary, purpose, structure, relations
3. **Show the user**: Present the draft and ask for confirmation
4. **Create the file**: Write to `.concepts/{slug}.md` with `status: draft`
5. **Link relations**: Check if related concepts exist; if so, add reciprocal links to their files

## Updating a Concept

When a concept seems to be shifting:

1. **Read the current definition**: Show the user what's defined
2. **Identify the change**: What's different? New distinction? Broader scope? Split?
3. **Propose the update**: Show a diff or rewrite
4. **Update the file**: Edit in place, or deprecate and create a new concept

## Suggesting Concepts

When examining a project for potential concepts:

1. **Scan for recurring vocabulary**: Look at file names, directory names, README, documentation, recent conversations
2. **Look for implicit distinctions**: Things that are different but not named differently
3. **Check breadcrumbs and reflections**: Themes that keep appearing
4. **Propose 3-5 candidates**: Name, one-line summary, and why it seems worth defining
5. **Let the user choose**: Don't create concepts without confirmation

## What You Do NOT Do

- Do not create concepts without the user's confirmation
- Do not auto-update concepts from conversation — flag the change, let the user decide
- Do not define implementation concepts (classes, modules, APIs) — use chronicle for that
- Do not push the ontology on users who haven't asked for it
- Do not treat this as a taxonomy exercise — the goal is shared vocabulary, not classification
