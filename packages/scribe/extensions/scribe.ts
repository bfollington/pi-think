/**
 * Scribe Extension
 *
 * Maintains a running trace of meaningful session transitions as a markdown file
 * with YAML frontmatter. Trace entries are generated sideband — a lightweight LLM
 * call runs after each agent loop, observing the conversation and deciding whether
 * to add a trace entry. The main agent never sees or writes to the trace.
 *
 * The user can view the trace via /scribe or Ctrl+Shift+S at any time.
 *
 * Manages persistent state (.scribe-state.json) to track unreflected sessions
 * and surface nag prompts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { convertToLlm } from "@mariozechner/pi-coding-agent";
import { completeSimple, getModel } from "@mariozechner/pi-ai";
import type { Message } from "@mariozechner/pi-ai";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface ScribeConfig {
  notesDir: string | null; // null = use local .traces/
  nagThreshold: number;
  /** Provider for sideband model (default: "anthropic") */
  sidebandProvider: string;
  /** Model ID for sideband calls (default: "claude-haiku-4-5") */
  sidebandModel: string;
}

interface ScribeState {
  last_reflection_at: string | null;
  unreflected_trace_count: number;
  unreflected_trace_files: string[];
  nag_threshold: number;
  nag_shown_this_session: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ulid(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const rand = Array.from({ length: 16 }, () =>
    "0123456789ABCDEFGHJKMNPQRSTVWXYZ"[Math.floor(Math.random() * 32)]
  ).join("");
  return ts + rand;
}

function timestamp(): string {
  return new Date().toISOString();
}

function timeShort(): string {
  return new Date().toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function dateSlug(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadConfig(cwd: string): ScribeConfig {
  const notebookConfigPath = path.join(cwd, ".pi", "notebook.json");
  let notesDir: string | null = null;
  let sidebandProvider = "anthropic";
  let sidebandModel = "claude-haiku-4-5";

  if (fs.existsSync(notebookConfigPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(notebookConfigPath, "utf-8"));
      if (raw.notes_dir) {
        notesDir = raw.notes_dir.startsWith("~")
          ? path.join(os.homedir(), raw.notes_dir.slice(1))
          : path.resolve(cwd, raw.notes_dir);
      }
      if (raw.scribe_provider) sidebandProvider = raw.scribe_provider;
      if (raw.scribe_model) sidebandModel = raw.scribe_model;
    } catch {}
  }

  if (!notesDir && process.env.NOTES_DIR) {
    const envDir = process.env.NOTES_DIR;
    notesDir = envDir.startsWith("~")
      ? path.join(os.homedir(), envDir.slice(1))
      : path.resolve(cwd, envDir);
  }

  return { notesDir, nagThreshold: 5, sidebandProvider, sidebandModel };
}

function stateFilePath(traceDirPath?: string): string {
  // Per-project state: lives alongside the traces it tracks
  if (traceDirPath) {
    if (!fs.existsSync(traceDirPath)) {
      fs.mkdirSync(traceDirPath, { recursive: true });
    }
    return path.join(traceDirPath, ".scribe-state.json");
  }
  // Fallback to legacy global location (should not normally be reached)
  const configDir = path.join(os.homedir(), ".config", "pi");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return path.join(configDir, "scribe-state.json");
}

function loadState(traceDirPath?: string): ScribeState {
  const p = stateFilePath(traceDirPath);
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {}
  }

  // Migrate from legacy global state if it exists and has traces for this directory
  if (traceDirPath) {
    const legacyPath = path.join(os.homedir(), ".config", "pi", "scribe-state.json");
    if (fs.existsSync(legacyPath)) {
      try {
        const legacy: ScribeState = JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
        const myTraces = legacy.unreflected_trace_files.filter(f =>
          f.startsWith(traceDirPath + path.sep) || f.startsWith(traceDirPath + "/")
        );
        if (myTraces.length > 0) {
          const migrated: ScribeState = {
            last_reflection_at: legacy.last_reflection_at,
            unreflected_trace_count: myTraces.length,
            unreflected_trace_files: myTraces,
            nag_threshold: legacy.nag_threshold,
            nag_shown_this_session: false,
          };

          // Remove migrated traces from legacy state
          legacy.unreflected_trace_files = legacy.unreflected_trace_files.filter(
            f => !myTraces.includes(f)
          );
          legacy.unreflected_trace_count = legacy.unreflected_trace_files.length;
          fs.writeFileSync(legacyPath, JSON.stringify(legacy, null, 2));

          // Save migrated state to per-project location
          fs.writeFileSync(p, JSON.stringify(migrated, null, 2));
          return migrated;
        }
      } catch {}
    }
  }

  return {
    last_reflection_at: null,
    unreflected_trace_count: 0,
    unreflected_trace_files: [],
    nag_threshold: 5,
    nag_shown_this_session: false,
  };
}

function saveState(state: ScribeState, traceDirPath?: string): void {
  const p = stateFilePath(traceDirPath);
  fs.writeFileSync(p, JSON.stringify(state, null, 2));
}

// ---------------------------------------------------------------------------
// Trace file operations
// ---------------------------------------------------------------------------

function traceDir(config: ScribeConfig, cwd: string): string {
  if (config.notesDir) {
    return path.join(config.notesDir, "traces");
  }
  return path.join(cwd, ".traces");
}

function createTraceFile(
  config: ScribeConfig,
  cwd: string,
  sessionId: string
): string {
  const dir = traceDir(config, cwd);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, `${sessionId}.md`);

  const frontmatter = [
    "---",
    `session_id: ${sessionId}`,
    `started_at: ${timestamp()}`,
    `ended_at: ~`,
    `working_dir: ${cwd}`,
    `unreflected: true`,
    `tags: []`,
    `notes_created: []`,
    `notes_touched: []`,
    `files_modified: []`,
    "---",
    "",
    `# Session trace — ${dateSlug()}`,
    "",
    `## ${timeShort()} — Session started`,
    `Working in ${cwd}.`,
    "",
  ].join("\n");

  fs.writeFileSync(filePath, frontmatter);
  return filePath;
}

function appendTraceEntry(
  traceFile: string,
  label: string,
  body: string,
): void {
  const entry = `## ${timeShort()} — ${label}\n${body}\n\n`;
  fs.appendFileSync(traceFile, entry);
}

function readTraceContents(traceFile: string): string {
  if (!fs.existsSync(traceFile)) return "(no trace file)";
  return fs.readFileSync(traceFile, "utf-8");
}

function updateTraceFrontmatter(
  traceFile: string,
  updates: Record<string, string>
): void {
  if (!fs.existsSync(traceFile)) return;
  let content = fs.readFileSync(traceFile, "utf-8");

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}:.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}: ${value}`);
    }
  }

  fs.writeFileSync(traceFile, content);
}

// ---------------------------------------------------------------------------
// Sideband trace generation
// ---------------------------------------------------------------------------

/** Summarize messages into a compact text representation for the scribe LLM */
function messagesToText(messages: Message[]): string {
  const parts: string[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      const text = typeof msg.content === "string"
        ? msg.content
        : msg.content
            .filter((c): c is { type: "text"; text: string } => c.type === "text")
            .map((c) => c.text)
            .join("\n");
      parts.push(`[user] ${text}`);
    } else if (msg.role === "assistant") {
      const textParts = msg.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text);
      const toolCalls = msg.content
        .filter((c): c is { type: "toolCall"; name: string; arguments: Record<string, any> } => c.type === "toolCall")
        .map((c) => `${c.name}(${Object.entries(c.arguments).map(([k, v]) => {
          const val = typeof v === "string" ? (v.length > 100 ? v.slice(0, 100) + "…" : v) : JSON.stringify(v);
          return `${k}: ${val}`;
        }).join(", ")})`);
      if (textParts.length > 0) parts.push(`[assistant] ${textParts.join("\n")}`);
      if (toolCalls.length > 0) parts.push(`[tools] ${toolCalls.join("; ")}`);
    } else if (msg.role === "toolResult") {
      const text = msg.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text.length > 200 ? c.text.slice(0, 200) + "…" : c.text)
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

const SCRIBE_SYSTEM_PROMPT = `You are a session scribe. You observe an AI coding agent's conversation and maintain a trace document — a concise record of meaningful cognitive transitions.

Your job: given the trace so far and the latest exchange, decide whether to add a new entry. Not every exchange deserves an entry. Only write one when something meaningfully changed:
- A direction change, decision, or conclusion
- A file was created, modified, or an important read happened
- An open question surfaced or was resolved
- The user shifted topics or expressed a new intent
- A suggestion that might be useful to surface later

If nothing meaningful happened (e.g., a clarifying question, a minor correction, routine tool output), respond with exactly: NO_ENTRY

If something meaningful happened, respond with exactly one trace entry in this format:
## HH:MM — Label
1-3 sentence description.

Use the current time provided. Keep entries concise and factual. You are an observer, not a participant. Do not editorialize or analyze — just record what happened and why it matters.

If you notice something the user might want to revisit later but that wasn't explicitly discussed, you can mark it as a suggestion:
## HH:MM — Suggestion
Description of what might be worth revisiting.`;

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function scribeExtension(pi: ExtensionAPI) {
  let config: ScribeConfig;
  let state: ScribeState;
  let sessionId: string;
  let traceFile: string;
  let traceDirPath: string;
  let entryCount = 0;
  let cwd: string;
  let sidebandInFlight = false;
  let lastProcessedMessageCount = 0;

  // --- Session start: create trace, check nag ---

  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
    config = loadConfig(cwd);
    traceDirPath = traceDir(config, cwd);
    state = loadState(traceDirPath);
    sessionId = ulid();
    traceFile = createTraceFile(config, cwd, sessionId);
    entryCount = 1;

    updateStatus(ctx);
  });

  // --- System prompt injection (lightweight — just tells the agent the trace exists) ---

  pi.on("before_agent_start", async (event, _ctx) => {
    let injection = `
You have the scribe extension loaded. A trace file for this session is at:
${traceFile}

The scribe automatically maintains this trace — you do not need to write to it.
The user can view the trace via /scribe or Ctrl+Shift+S at any time.

The user can also write into the trace file directly via the scribe overlay. If you
notice new user-written entries (marked [user]) in the trace file at the start of
a turn, acknowledge and respond to them appropriately.
`;

    // Nag injection
    if (
      state.unreflected_trace_count >= state.nag_threshold &&
      !state.nag_shown_this_session
    ) {
      const lastDate = state.last_reflection_at
        ? new Date(state.last_reflection_at).toLocaleDateString()
        : "never";
      injection += `
Note: there are ${state.unreflected_trace_count} sessions since your last reflection on ${lastDate}. If the user has a moment, suggest \`/skill:reflection\` — they may not know this is available.
`;
      state.nag_shown_this_session = true;
      saveState(state, traceDirPath);
    }

    return {
      systemPrompt: event.systemPrompt + injection,
    };
  });

  // --- Track tool calls for files_modified ---

  const filesModified = new Set<string>();

  pi.on("tool_call", async (event, _ctx) => {
    if (event.toolName === "write" || event.toolName === "edit") {
      const input = event.input as { path?: string };
      if (input.path) {
        filesModified.add(input.path);
      }
    }
  });

  // --- Sideband trace generation on agent_end ---

  pi.on("agent_end", async (event, ctx) => {
    if (sidebandInFlight) return; // Skip if a sideband call is already running
    if (!traceFile || !fs.existsSync(traceFile)) return;

    const newMessages = event.messages;
    if (!newMessages || newMessages.length === 0) return;

    // Convert agent messages to LLM-compatible format for the scribe
    let llmMessages: Message[];
    try {
      llmMessages = convertToLlm(newMessages);
    } catch {
      return; // If conversion fails, skip silently
    }

    // Don't block the main conversation — fire and forget
    sidebandInFlight = true;
    generateTraceEntry(llmMessages, ctx).finally(() => {
      sidebandInFlight = false;
    });
  });

  async function generateTraceEntry(newMessages: Message[], ctx: ExtensionContext): Promise<void> {
    try {
      const model = getModel(config.sidebandProvider as any, config.sidebandModel as any);
      const apiKey = await ctx.modelRegistry.getApiKey(model);
      if (!apiKey) return; // No API key available, skip silently

      const traceContent = readTraceContents(traceFile);
      const conversationText = messagesToText(newMessages);
      const currentTime = timeShort();

      const context = {
        systemPrompt: SCRIBE_SYSTEM_PROMPT,
        messages: [
          {
            role: "user" as const,
            content: `Current time: ${currentTime}

TRACE SO FAR:
${traceContent}

LATEST EXCHANGE:
${conversationText}

Based on the latest exchange, should a new trace entry be added? Respond with the entry or NO_ENTRY.`,
            timestamp: Date.now(),
          },
        ],
      };

      const response = await completeSimple(model, context, { apiKey });

      // Extract text from response
      const responseText = response.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n")
        .trim();

      if (responseText === "NO_ENTRY" || responseText.startsWith("NO_ENTRY")) {
        return;
      }

      // Validate it looks like a trace entry (starts with ##)
      if (responseText.startsWith("## ")) {
        fs.appendFileSync(traceFile, responseText + "\n\n");

        // Update entry count and status
        if (fs.existsSync(traceFile)) {
          const content = fs.readFileSync(traceFile, "utf-8");
          entryCount = (content.match(/^## /gm) || []).length;
        }
        updateStatus(ctx);
      }
    } catch (err) {
      // Sideband failures are silent — the trace just won't have this entry
    }
  }

  // --- Session shutdown: finalize trace ---

  pi.on("session_shutdown", async (_event, _ctx) => {
    if (!traceFile || !fs.existsSync(traceFile)) return;

    // Write closing entry
    appendTraceEntry(
      traceFile,
      "Session end",
      `Session concluded. ${entryCount} trace entries recorded.`
    );

    // Update frontmatter
    updateTraceFrontmatter(traceFile, {
      ended_at: timestamp(),
      files_modified: JSON.stringify([...filesModified]),
    });

    // Update persistent state (per-project)
    state.unreflected_trace_count++;
    state.unreflected_trace_files.push(traceFile);
    state.nag_shown_this_session = false;
    saveState(state, traceDirPath);
  });

  // --- Status bar ---

  function updateStatus(ctx: ExtensionContext) {
    const theme = ctx.ui.theme;
    const unreflected = state.unreflected_trace_count;
    let statusText = theme.fg("dim", `scribe: ${entryCount} entries`);
    if (unreflected > 0) {
      statusText += theme.fg("warning", ` | ${unreflected} unreflected`);
    }
    ctx.ui.setStatus("scribe", statusText);
  }

  pi.on("turn_end", async (_event, ctx) => {
    if (fs.existsSync(traceFile)) {
      const content = fs.readFileSync(traceFile, "utf-8");
      entryCount = (content.match(/^## /gm) || []).length;
    }
    updateStatus(ctx);
  });

  // --- /scribe command: show trace contents ---

  pi.registerCommand("scribe", {
    description: "View the scribe trace for this session",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/scribe requires interactive mode", "error");
        return;
      }

      const content = readTraceContents(traceFile);
      const lines = content.split("\n");
      const theme = ctx.ui.theme;

      // Format for display
      const formatted = lines.map((line) => {
        if (line.startsWith("## ")) return theme.fg("accent", line);
        if (line.startsWith("# ")) return theme.bold(line);
        if (line.startsWith("---")) return theme.fg("dim", line);
        return theme.fg("muted", line);
      });

      ctx.ui.setWidget("scribe-trace", formatted);

      // Auto-clear widget after viewing (user presses any key to dismiss)
      const unsub = ctx.ui.onTerminalInput(() => {
        ctx.ui.setWidget("scribe-trace", undefined);
        unsub();
        return { consume: true };
      });
    },
  });

  // --- Keyboard shortcut for quick view ---

  pi.registerShortcut("ctrl+shift+s", {
    description: "Toggle scribe trace view",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;

      const content = readTraceContents(traceFile);
      const lines = content.split("\n");
      const theme = ctx.ui.theme;

      const formatted = lines.map((line) => {
        if (line.startsWith("## ")) return theme.fg("accent", line);
        if (line.startsWith("# ")) return theme.bold(line);
        if (line.startsWith("---")) return theme.fg("dim", line);
        return theme.fg("muted", line);
      });

      ctx.ui.setWidget("scribe-trace", formatted);

      const unsub = ctx.ui.onTerminalInput(() => {
        ctx.ui.setWidget("scribe-trace", undefined);
        unsub();
        return { consume: true };
      });
    },
  });
}
