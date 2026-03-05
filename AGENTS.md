# my-pi

Personal configuration repo for [pi.dev](https://pi.dev), a minimal terminal-based AI coding agent by Mario Zechner (`@mariozechner/pi-coding-agent`).

## What pi.dev is

Pi is a terminal-first coding agent with 4 built-in tools (`read`, `write`, `edit`, `bash`) and a TypeScript extension API. It supports 15+ LLM providers, tree-structured sessions, and is extensible via extensions, skills, prompts, and themes — bundled as pi packages.

## Repo purpose

This repo holds project-local pi configuration: extensions, skills, prompts, and themes that customize pi for Ben's workflow. It maps to the `.pi/` directory structure that pi auto-discovers.

## Pi configuration structure

```
.pi/
├── settings.json        # Project-specific settings (overrides ~/.pi/agent/settings.json)
├── SYSTEM.md            # Replace default system prompt (or use APPEND_SYSTEM.md to extend)
├── extensions/          # TypeScript extensions (*.ts or */index.ts)
├── skills/              # SKILL.md files loaded on demand
├── prompts/             # Reusable prompt templates
└── themes/              # TUI color schemes
```

Global config lives at `~/.pi/agent/` with the same structure. Project-local overrides global.

## Extension API essentials

Extensions export a default function receiving `ExtensionAPI`:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
export default function (pi: ExtensionAPI) { ... }
```

Key capabilities:
- **Lifecycle events**: `session_start`, `session_shutdown`, `before_agent_start`, `turn_start/end`, `message_end`, `tool_call`, `tool_result`, `input`, `session_compact`
- **Tool registration**: `pi.registerTool({ name, description, parameters, execute })`
- **Commands**: `pi.registerCommand("name", { description, handler })`
- **Shortcuts**: `pi.registerShortcut("ctrl+x", { handler })`
- **Context injection**: `context` event receives message array, returns modified version
- **Tool gating**: `tool_call` event can block/prevent tool execution
- **UI**: `ctx.ui.confirm()`, `ctx.ui.select()`, `ctx.ui.input()`, `ctx.ui.setStatus()`, `ctx.ui.setWidget()`

Dependencies: add `package.json` next to extension, `npm install`, imports resolve from `node_modules/`.

## Skills

Skills are `SKILL.md` files with frontmatter (`name`, `description`) and procedural instructions. Use `{baseDir}` for relative paths. Invoked via `/skill:name` or auto-loaded by the agent.

## Conventions

- Extensions are TypeScript, loaded via `jiti` (no compilation needed)
- Use `better-sqlite3` for any SQLite needs (sync, fast)
- Subagents spawn via `pi -p "prompt" --extensions .pi/extensions/`
- Schema definitions use `@sinclair/typebox`
- AGENTS.md (or CLAUDE.md) files layer from global → parent dirs → cwd
