/**
 * Chronicle Extension
 *
 * Auto-documents project knowledge by spawning a subagent after each agent loop.
 * The subagent observes the conversation and creates/updates atomic documentation
 * files in the project's docs/chronicle/ directory.
 *
 * Where scribe records *what happened* (session traces), chronicle records
 * *what is* and *what was decided* (project knowledge).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  createAgentSession,
  createReadTool,
  createWriteTool,
  createEditTool,
  convertToLlm,
  SessionManager,
} from "@mariozechner/pi-coding-agent";
import { getModel } from "@mariozechner/pi-ai";
import type { Message } from "@mariozechner/pi-ai";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface ChronicleConfig {
  docsDir: string;
  enabled: boolean;
  provider: string;
  model: string;
  categories: string[];
  autoCommit: boolean;
  subagentTimeoutMs: number;
}

function loadConfig(cwd: string): ChronicleConfig {
  const defaults: ChronicleConfig = {
    docsDir: "docs/chronicle",
    enabled: true,
    provider: "anthropic",
    model: "claude-haiku-4-5",
    categories: [
      "architecture",
      "domain-model",
      "decision",
      "convention",
      "plan",
      "api",
      "infrastructure",
    ],
    autoCommit: false,
    subagentTimeoutMs: 30_000,
  };

  // Try chronicle-specific config
  const chroniclePath = path.join(cwd, ".pi", "chronicle.json");
  if (fs.existsSync(chroniclePath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(chroniclePath, "utf-8"));
      return {
        docsDir: raw.docs_dir ?? defaults.docsDir,
        enabled: raw.enabled ?? defaults.enabled,
        provider: raw.provider ?? defaults.provider,
        model: raw.model ?? defaults.model,
        categories: raw.categories ?? defaults.categories,
        autoCommit: raw.auto_commit ?? defaults.autoCommit,
        subagentTimeoutMs: raw.subagent_timeout_ms ?? defaults.subagentTimeoutMs,
      };
    } catch {}
  }

  // Fall back to notebook config for provider/model
  const notebookPath = path.join(cwd, ".pi", "notebook.json");
  if (fs.existsSync(notebookPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(notebookPath, "utf-8"));
      if (raw.scribe_provider) defaults.provider = raw.scribe_provider;
      if (raw.scribe_model) defaults.model = raw.scribe_model;
    } catch {}
  }

  return defaults;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexId(len: number): string {
  return Array.from({ length: len }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

function timestamp(): string {
  return new Date().toISOString();
}

function ulid(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const rand = Array.from({ length: 16 }, () =>
    "0123456789ABCDEFGHJKMNPQRSTVWXYZ"[Math.floor(Math.random() * 32)]
  ).join("");
  return ts + rand;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function countDocs(docsDir: string): number {
  if (!fs.existsSync(docsDir)) return 0;
  return fs.readdirSync(docsDir).filter(
    (f) => f.endsWith(".md") && f !== "_index.md"
  ).length;
}

function readIndex(docsDir: string): string {
  const indexPath = path.join(docsDir, "_index.md");
  if (!fs.existsSync(indexPath)) return "(no index yet)";
  return fs.readFileSync(indexPath, "utf-8");
}

function createEmptyIndex(docsDir: string): void {
  const indexPath = path.join(docsDir, "_index.md");
  if (fs.existsSync(indexPath)) return;
  const content = [
    "---",
    `generated_at: ${timestamp()}`,
    "doc_count: 0",
    "---",
    "",
    "# Chronicle Index",
    "",
    "_No docs yet. Chronicle will populate this as project knowledge surfaces._",
    "",
  ].join("\n");
  fs.writeFileSync(indexPath, content);
}

// ---------------------------------------------------------------------------
// Conversation summary (same pattern as scribe)
// ---------------------------------------------------------------------------

function messagesToText(messages: Message[]): string {
  const parts: string[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : msg.content
              .filter(
                (c): c is { type: "text"; text: string } => c.type === "text"
              )
              .map((c) => c.text)
              .join("\n");
      parts.push(`[user] ${text}`);
    } else if (msg.role === "assistant") {
      const textParts = msg.content
        .filter(
          (c): c is { type: "text"; text: string } => c.type === "text"
        )
        .map((c) => c.text);
      const toolCalls = msg.content
        .filter(
          (c): c is {
            type: "toolCall";
            name: string;
            arguments: Record<string, any>;
          } => c.type === "toolCall"
        )
        .map((c) => {
          const args = Object.entries(c.arguments)
            .map(([k, v]) => {
              const val =
                typeof v === "string"
                  ? v.length > 100
                    ? v.slice(0, 100) + "…"
                    : v
                  : JSON.stringify(v);
              return `${k}: ${val}`;
            })
            .join(", ");
          return `${c.name}(${args})`;
        });
      if (textParts.length > 0)
        parts.push(`[assistant] ${textParts.join("\n")}`);
      if (toolCalls.length > 0)
        parts.push(`[tools] ${toolCalls.join("; ")}`);
    } else if (msg.role === "toolResult") {
      const text = msg.content
        .filter(
          (c): c is { type: "text"; text: string } => c.type === "text"
        )
        .map((c) =>
          c.text.length > 200 ? c.text.slice(0, 200) + "…" : c.text
        )
        .join("\n");
      if (msg.isError) {
        parts.push(`[tool error: ${msg.toolName}] ${text}`);
      } else {
        parts.push(`[tool result: ${msg.toolName}] ${text}`);
      }
    }
  }
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Subagent system prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  config: ChronicleConfig,
  docsDir: string,
  indexContents: string,
  sessionId: string,
): string {
  return `You are a project chronicler. You observe a coding session's latest exchange and decide whether any project knowledge changed enough to warrant documentation.

You have access to read, write, and edit tools. The project's chronicle docs live at:
${docsDir}/

CURRENT INDEX:
${indexContents}

Your job:
1. Read the latest exchange below.
2. Decide: did any structural project knowledge change?
3. If yes, use your tools to create or update the appropriate doc(s).
4. If no, just say "No documentation changes needed." and stop.

You are looking for changes to:
${config.categories.map((c) => `- ${c}`).join("\n")}

When you DO write, follow these rules:

FILE FORMAT: Each doc is a markdown file at ${docsDir}/{slug}.md with this frontmatter:
---
doc_id: D-{8 random hex chars}
title: Human Readable Title
category: ${config.categories.join("|")}
created_at: {ISO 8601}
updated_at: {ISO 8601}
session_id: ${sessionId}
status: current
tags: [relevant, tags]
related: [other-doc-slug]
---

# Title

Body content here.

WRITING RULES:
- One doc = one concept. Keep docs atomic.
- 50-200 words typical, never more than 500.
- Write in present tense ("The system uses..." not "We decided to use...")
- For decisions, always include the rationale and alternatives considered.
- Link to related docs using [[slug]] wikilinks in the body.
- If updating an existing doc, read it first, then use edit for surgical changes or write for full replacement. Update the updated_at timestamp.
- After creating or updating docs, also update ${docsDir}/_index.md to reflect the current set of docs grouped by category. Read it first, then write the updated version.

JUDGMENT RULES:
- Bias toward NOT writing. Most exchanges don't produce documentation-worthy changes.
- Don't document implementation details — that's what the code is for.
- Don't document what happened chronologically — that's what scribe traces are for.
- DO document what IS: the current state of the system's design, rules, and plans.
- Routine bug fixes, file reads, exploration, and clarifying questions → no docs.
- If you're unsure whether something is worth documenting, don't.
- Be efficient with tool calls. Don't read files you don't need.`;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function chronicleExtension(pi: ExtensionAPI) {
  let config: ChronicleConfig;
  let docsDir: string;
  let cwd: string;
  let sessionId: string;
  let subagentInFlight = false;
  let docsCreatedThisSession = 0;
  let docsUpdatedThisSession = 0;
  let initialDocCount = 0;

  // --- Session start ---

  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
    config = loadConfig(cwd);
    if (!config.enabled) return;

    sessionId = ulid();
    docsDir = path.resolve(cwd, config.docsDir);
    ensureDir(docsDir);
    createEmptyIndex(docsDir);
    initialDocCount = countDocs(docsDir);

    updateStatus(ctx);
  });

  // --- System prompt injection ---

  pi.on("before_agent_start", async (event, _ctx) => {
    if (!config?.enabled) return;

    const docCount = countDocs(docsDir);
    const slugs = fs
      .readdirSync(docsDir)
      .filter((f) => f.endsWith(".md") && f !== "_index.md")
      .map((f) => f.replace(".md", ""));

    let injection = `\nThis project has chronicle documentation at ${config.docsDir}/. The chronicler extension auto-maintains these docs — you don't need to write them yourself. You can reference them with [[slug]] links.`;

    if (slugs.length > 0) {
      injection += `\nCurrent docs (${docCount}): ${slugs.join(", ")}`;
    }

    return {
      systemPrompt: event.systemPrompt + injection,
    };
  });

  // --- Spawn subagent on agent_end ---

  pi.on("agent_end", async (event, ctx) => {
    if (!config?.enabled) return;
    if (subagentInFlight) return;
    if (!event.messages || event.messages.length === 0) return;

    // Convert messages for summary
    let llmMessages: Message[];
    try {
      llmMessages = convertToLlm(event.messages);
    } catch {
      return;
    }

    const conversationText = messagesToText(llmMessages);
    if (conversationText.trim().length < 50) return; // Skip trivial exchanges

    subagentInFlight = true;
    runChronicleSubagent(conversationText, ctx).finally(() => {
      subagentInFlight = false;
    });
  });

  async function runChronicleSubagent(
    conversationText: string,
    ctx: ExtensionContext,
  ): Promise<void> {
    const docCountBefore = countDocs(docsDir);

    try {
      const indexContents = readIndex(docsDir);
      const systemPrompt = buildSystemPrompt(
        config,
        docsDir,
        indexContents,
        sessionId,
      );

      const model = getModel(config.provider as any, config.model as any);

      // Create tools scoped to project cwd
      const tools = [
        createReadTool(cwd),
        createWriteTool(cwd),
        createEditTool(cwd),
      ];

      const { session } = await createAgentSession({
        cwd,
        model,
        tools,
        modelRegistry: ctx.modelRegistry,
        sessionManager: SessionManager.inMemory(cwd),
        systemPrompt,
        extensions: [], // No extensions for the subagent
      });

      // Set up timeout
      const timeout = setTimeout(() => {
        try {
          session.abort();
        } catch {}
      }, config.subagentTimeoutMs);

      try {
        await session.prompt(
          `Here is the latest exchange from the coding session. Evaluate whether any project documentation needs to be created or updated.\n\nLATEST EXCHANGE:\n${conversationText}`
        );
      } finally {
        clearTimeout(timeout);
        session.dispose();
      }

      // Count changes
      const docCountAfter = countDocs(docsDir);
      if (docCountAfter > docCountBefore) {
        docsCreatedThisSession += docCountAfter - docCountBefore;
      }
      // We can't easily distinguish updates from creates by count alone,
      // but the status bar shows the total activity

      updateStatus(ctx);
    } catch (err) {
      // Subagent failures are silent — docs just won't update this turn
    }
  }

  // --- Session shutdown ---

  pi.on("session_shutdown", async (_event, _ctx) => {
    // Nothing to finalize — docs are already written by the subagent
  });

  // --- Status bar ---

  function updateStatus(ctx: ExtensionContext) {
    if (!config?.enabled) return;
    const theme = ctx.ui.theme;
    const total = countDocs(docsDir);
    const activity = docsCreatedThisSession + docsUpdatedThisSession;

    let statusText = theme.fg("dim", `chronicle: ${total} docs`);
    if (activity > 0) {
      statusText += theme.fg("accent", ` | ${activity} this session`);
    }
    ctx.ui.setStatus("chronicle", statusText);
  }

  pi.on("turn_end", async (_event, ctx) => {
    if (!config?.enabled) return;
    updateStatus(ctx);
  });

  // --- Commands ---

  pi.registerCommand("chronicle", {
    description: "View the chronicle index for this project",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/chronicle requires interactive mode", "error");
        return;
      }

      const content = readIndex(docsDir);
      const lines = content.split("\n");
      const theme = ctx.ui.theme;

      const formatted = lines.map((line) => {
        if (line.startsWith("## ")) return theme.fg("accent", line);
        if (line.startsWith("# ")) return theme.bold(line);
        if (line.startsWith("---")) return theme.fg("dim", line);
        if (line.startsWith("- ")) return theme.fg("muted", line);
        return line;
      });

      ctx.ui.setWidget("chronicle-index", formatted);

      const unsub = ctx.ui.onTerminalInput(() => {
        ctx.ui.setWidget("chronicle-index", undefined);
        unsub();
        return { consume: true };
      });
    },
  });

  pi.registerCommand("chronicle:show", {
    description: "Show a specific chronicle doc by slug",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/chronicle:show requires interactive mode", "error");
        return;
      }

      const slug = args.trim();
      if (!slug) {
        ctx.ui.notify("Usage: /chronicle:show <slug>", "error");
        return;
      }

      const filePath = path.join(docsDir, `${slug}.md`);
      if (!fs.existsSync(filePath)) {
        ctx.ui.notify(`Doc not found: ${slug}`, "error");
        return;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      const theme = ctx.ui.theme;

      const formatted = lines.map((line) => {
        if (line.startsWith("## ")) return theme.fg("accent", line);
        if (line.startsWith("# ")) return theme.bold(line);
        if (line.startsWith("---")) return theme.fg("dim", line);
        return theme.fg("muted", line);
      });

      ctx.ui.setWidget("chronicle-doc", formatted);

      const unsub = ctx.ui.onTerminalInput(() => {
        ctx.ui.setWidget("chronicle-doc", undefined);
        unsub();
        return { consume: true };
      });
    },
  });

  pi.registerCommand("chronicle:search", {
    description: "Search chronicle docs by keyword",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/chronicle:search requires interactive mode", "error");
        return;
      }

      const query = args.trim().toLowerCase();
      if (!query) {
        ctx.ui.notify("Usage: /chronicle:search <query>", "error");
        return;
      }

      if (!fs.existsSync(docsDir)) {
        ctx.ui.notify("No chronicle docs yet", "info");
        return;
      }

      const results: string[] = [];
      const files = fs
        .readdirSync(docsDir)
        .filter((f) => f.endsWith(".md") && f !== "_index.md");

      for (const file of files) {
        const content = fs.readFileSync(path.join(docsDir, file), "utf-8");
        if (content.toLowerCase().includes(query)) {
          // Extract title from frontmatter
          const titleMatch = content.match(/^title:\s*(.+)$/m);
          const title = titleMatch?.[1] ?? file.replace(".md", "");
          const slug = file.replace(".md", "");
          results.push(`  ${slug} — ${title}`);
        }
      }

      const theme = ctx.ui.theme;
      const output = results.length > 0
        ? [theme.bold(`Search: "${query}" (${results.length} results)`), "", ...results]
        : [theme.fg("dim", `No docs matching "${query}"`)];

      ctx.ui.setWidget("chronicle-search", output);

      const unsub = ctx.ui.onTerminalInput(() => {
        ctx.ui.setWidget("chronicle-search", undefined);
        unsub();
        return { consume: true };
      });
    },
  });
}
