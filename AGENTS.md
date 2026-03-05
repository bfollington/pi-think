# pi-think

Monorepo of composable [pi.dev](https://pi.dev) packages — extensions, skills, and prompts for project memory.

## Repo purpose

This repo holds independently installable pi packages: each subdirectory under `packages/` is a standalone pi package that can be installed into any project via `pi install ./packages/<name>`.

## Package layout

```
packages/
├── scribe/           # Extension: session trace recorder (sideband LLM)
├── chronicle/        # Extension: auto-documentation (subagent with tools)
├── notebook/         # Skill + prompt: atomic note-taking conventions
└── reflection/       # Skill + prompt: cross-session metacognition
```

Each package uses pi's conventional directory structure (`extensions/`, `skills/`, `prompts/`) and declares a `package.json` with `"keywords": ["pi-package"]`.

## Pi package conventions

- Extensions are TypeScript, loaded via `jiti` (no compilation needed)
- Skills are `SKILL.md` files with YAML frontmatter
- Prompts are `.md` files in a `prompts/` directory
- Core pi packages (`@mariozechner/pi-coding-agent`, `@mariozechner/pi-ai`, etc.) go in `peerDependencies` with `"*"` range
- Third-party runtime deps go in `dependencies`

## Development

This repo's `.pi/settings.json` references all local packages for development:

```json
{
  "packages": [
    "./packages/scribe",
    "./packages/chronicle",
    "./packages/notebook",
    "./packages/reflection"
  ]
}
```

Additional project-local config (`.pi/notebook.json`, `.pi/agents/`, `.pi/APPEND_SYSTEM.md`) stays in `.pi/` — these are development/testing resources, not distributable packages.

## Key dependencies between packages

All dependencies are **soft** — packages read each other's files but don't import each other's code:

- **Reflection** reads scribe's trace files and writes to notebook's notes directory
- **Scribe** is standalone
- **Chronicle** is standalone
- **Notebook** is standalone; when scribe is co-loaded, traces appear in the notes graph
