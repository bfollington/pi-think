---
description: Quick note capture — break raw thought into atomic, linked notes
---
First load the notebook skill by reading its SKILL.md (use /skill:notebook or find it in the loaded skills), then use its instructions to process this capture.

I want to capture something. Here's the raw input — apply this process:

## Process

1. **Record first.** Read the full input before asking questions. Don't interrupt a dump.

2. **Apply the index card test.** Each note should stand alone and say something meaningful when encountered later. Not post-it notes ("less state machine, more differential equations") — index cards that carry enough context to be useful in isolation ("Less state machine, more differential equations — the system evolves continuously based on conditions, not discrete transitions. Small changes yield large effects because you're shaping a possibility space, not defining fixed states.").

3. **Search before create.** Check the vault for related notes (grep, obsidian CLI, or qmd if available). If a closely related note exists, prefer linking to it or elaborating it over creating a duplicate. Tell me what you found.

4. **Propose the breakdown.** Before creating anything, show me:
   - Each proposed note with a working title and one-sentence summary
   - Theme clusters if there are several
   - Related existing notes you found
   - Ask me to confirm or adjust granularity

5. **Create notes.** Once I confirm, create each note in `inbox/` following the notebook skill conventions (frontmatter, slug filename, wikilinks to related notes inline in the body).

6. **Link.** Wire up wikilinks between the new notes and any related existing notes.

7. **Offer next steps.** After capture, ask:
   - "Want to drop a breadcrumb? (`/crumb`)" — snapshot your thinking state
   - "Want to keep capturing?" — stay in flow
   - "Want a briefing on what's active? (`/recent`)" — orient

---

Raw input:

$@
