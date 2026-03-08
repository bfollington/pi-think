---
description: Examine the project and suggest concepts that could be defined in the ontology
---
First load the concepts skill by reading its SKILL.md (use /skill:concepts or find it in the loaded skills).

Look at this project and suggest concepts that might be worth defining.

## Focus (if any)

$@

## Process

1. **Read existing concepts**: Check `.concepts/` for what's already defined.

2. **Scan the project for recurring vocabulary**:
   - README, documentation, and any SKILL.md files
   - Directory structure and file naming conventions
   - Recent breadcrumbs and reflections (if they exist)
   - Recent traces (if scribe is loaded)
   - Configuration files

3. **Identify candidates**: Look for:
   - Words or phrases used repeatedly with specific meaning
   - Things that are distinguished in practice but not named
   - Patterns surfaced in reflections that deserve a name
   - Implicit categories (file types, note types, workflow stages)
   - Concepts the user seems to care about distinguishing

4. **Propose 3-5 candidates**: For each, give:
   - **Name**: What to call it
   - **Summary**: One sentence on what it is
   - **Why define it**: What confusion or missed connection would this resolve?
   - **Related to**: What existing concepts or project structures it connects to

5. **Let me choose**: Don't create anything — just propose. I'll tell you which ones to define.

Don't propose concepts that are purely implementation details (classes, modules, API endpoints) — those belong in chronicle documentation, not the ontology.
