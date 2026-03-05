/**
 * Scribe Extension
 *
 * Maintains a running trace of meaningful session transitions as a markdown file
 * with YAML frontmatter. Introduces a second loop: the user can view the trace
 * via the /scribe command or Ctrl+Shift+S overlay at any time.
 *
 * Manages persistent state (.scribe-state.json) to track unreflected sessions
 * and surface nag prompts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface ScribeConfig {
  notesDir: string | null; // null = use local .traces/
  nagThreshold: number;
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

  if (fs.existsSync(notebookConfigPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(notebookConfigPath, "utf-8"));
      if (raw.notes_dir) {
        notesDir = raw.notes_dir.startsWith("~")
          ? path.join(os.homedir(), raw.notes_dir.slice(1))
          : raw.notes_dir;
      }
    } catch {}
  }

  if (!notesDir && process.env.NOTES_DIR) {
    notesDir = process.env.NOTES_DIR;
  }

  return { notesDir, nagThreshold: 5 };
}

function stateFilePath(): string {
  const configDir = path.join(os.homedir(), ".config", "pi");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return path.join(configDir, "scribe-state.json");
}

function loadState(): ScribeState {
  const p = stateFilePath();
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {}
  }
  return {
    last_reflection_at: null,
    unreflected_trace_count: 0,
    unreflected_trace_files: [],
    nag_threshold: 5,
    nag_shown_this_session: false,
  };
}

function saveState(state: ScribeState): void {
  const p = stateFilePath();
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
// Extension
// ---------------------------------------------------------------------------

export default function scribeExtension(pi: ExtensionAPI) {
  let config: ScribeConfig;
  let state: ScribeState;
  let sessionId: string;
  let traceFile: string;
  let entryCount = 0;
  let cwd: string;

  // --- Session start: create trace, check nag ---

  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
    config = loadConfig(cwd);
    state = loadState();
    sessionId = ulid();
    traceFile = createTraceFile(config, cwd, sessionId);
    entryCount = 1;

    updateStatus(ctx);
  });

  // --- System prompt injection ---

  pi.on("before_agent_start", async (event, _ctx) => {
    let injection = `
You have the scribe extension loaded. A trace file for this session is at:
${traceFile}

At meaningful transitions — direction changes, decisions, open questions, file
modifications, suggestions you want to surface — write a brief entry to this file
using the write tool (append to the file). Keep entries to 1-3 sentences. Do not
write an entry for every message; only when something meaningfully changes.

Format each entry as a markdown heading:
## HH:MM — Label
Brief description.

You may also write suggestion entries when you notice something useful to the user
that does not need to interrupt the main conversation. Mark these as:
## HH:MM — Suggestion [agent]

The user can write into the trace file directly via the scribe overlay. If you
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
      saveState(state);
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

    // Update persistent state
    state.unreflected_trace_count++;
    state.unreflected_trace_files.push(traceFile);
    state.nag_shown_this_session = false;
    saveState(state);
  });

  // --- Track when agent writes to trace file to update entry count ---

  pi.on("tool_result", async (event, _ctx) => {
    if (event.toolName === "write" || event.toolName === "edit") {
      const input = event.input as { path?: string };
      if (input.path && path.resolve(input.path) === path.resolve(traceFile)) {
        if (fs.existsSync(traceFile)) {
          const content = fs.readFileSync(traceFile, "utf-8");
          entryCount = (content.match(/^## /gm) || []).length;
        }
      }
    }
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
