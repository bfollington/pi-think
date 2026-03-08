/**
 * Concepts Extension
 *
 * Manages the conceptual domain model for a project. Reads concept definition
 * files from a .concepts/ directory and injects a compact ontology summary into
 * the agent's system prompt at session start.
 *
 * Concept files are plain markdown with YAML frontmatter. The extension does
 * not modify concepts automatically — updates happen through explicit
 * conversation guided by the concepts skill and prompts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "yaml";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface ConceptsConfig {
  conceptsDir: string;
}

function loadConfig(cwd: string): ConceptsConfig {
  // Check .pi/concepts.json for custom location
  const configPath = path.join(cwd, ".pi", "concepts.json");
  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (raw.concepts_dir) {
        return {
          conceptsDir: path.resolve(cwd, raw.concepts_dir),
        };
      }
    } catch {}
  }

  return { conceptsDir: path.join(cwd, ".concepts") };
}

// ---------------------------------------------------------------------------
// Concept file parsing
// ---------------------------------------------------------------------------

interface Concept {
  name: string;
  slug: string;
  aliases: string[];
  related: string[];
  status: "active" | "draft" | "deprecated";
  summary: string; // first paragraph of body
  filePath: string;
}

function parseConcept(filePath: string): Concept | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!fmMatch) return null;

    const fm = yaml.parse(fmMatch[1]) ?? {};
    const body = fmMatch[2].trim();

    // Extract first non-heading paragraph as summary
    const lines = body.split("\n");
    let summary = "";
    let inParagraph = false;
    for (const line of lines) {
      if (line.startsWith("#")) continue;
      if (line.trim() === "") {
        if (inParagraph) break;
        continue;
      }
      inParagraph = true;
      summary += (summary ? " " : "") + line.trim();
    }

    const slug = path.basename(filePath, ".md");

    return {
      name: fm.name ?? slug,
      slug,
      aliases: fm.aliases ?? [],
      related: fm.related ?? [],
      status: fm.status ?? "active",
      summary: summary.slice(0, 300),
      filePath,
    };
  } catch {
    return null;
  }
}

function loadConcepts(dir: string): Concept[] {
  if (!fs.existsSync(dir)) return [];

  const concepts: Concept[] = [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".md")).sort();

  for (const file of files) {
    const concept = parseConcept(path.join(dir, file));
    if (concept && concept.status !== "deprecated") {
      concepts.push(concept);
    }
  }

  return concepts;
}

// ---------------------------------------------------------------------------
// System prompt generation
// ---------------------------------------------------------------------------

function buildOntologyBlurb(concepts: Concept[], conceptsDir: string): string {
  if (concepts.length === 0) return "";

  const lines: string[] = [
    "",
    "This project has a defined conceptual ontology. The following concepts are",
    `defined in \`${conceptsDir}\` — use them as shared vocabulary with the user.`,
    "",
  ];

  for (const c of concepts) {
    let line = `- **${c.name}**`;
    if (c.aliases.length > 0) {
      line += ` (${c.aliases.join(", ")})`;
    }
    line += `: ${c.summary}`;
    if (c.related.length > 0) {
      line += ` → ${c.related.map(r => `[[${r}]]`).join(", ")}`;
    }
    lines.push(line);
  }

  lines.push("");
  lines.push(
    "When the user refers to these concepts (or their aliases), use the defined meaning.",
    "If a concept seems to be evolving or a new one emerging, mention it — the user can",
    "update the ontology with `/define` or review it with `/concepts`.",
  );
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function conceptsExtension(pi: ExtensionAPI) {
  let config: ConceptsConfig;
  let concepts: Concept[] = [];

  pi.on("session_start", async (_event, ctx) => {
    config = loadConfig(ctx.cwd);
    concepts = loadConcepts(config.conceptsDir);
    updateStatus(ctx);
  });

  pi.on("before_agent_start", async (event, _ctx) => {
    // Reload concepts each turn in case they were modified during the session
    concepts = loadConcepts(config.conceptsDir);

    const blurb = buildOntologyBlurb(concepts, config.conceptsDir);
    if (!blurb) return;

    return {
      systemPrompt: event.systemPrompt + blurb,
    };
  });

  function updateStatus(ctx: any) {
    if (concepts.length === 0) return;
    const theme = ctx.ui.theme;
    const count = concepts.length;
    const draft = concepts.filter(c => c.status === "draft").length;
    let text = theme.fg("dim", `concepts: ${count}`);
    if (draft > 0) {
      text += theme.fg("warning", ` (${draft} draft)`);
    }
    ctx.ui.setStatus("concepts", text);
  }

  // Refresh status after each turn (concepts may have been created/updated)
  pi.on("turn_end", async (_event, ctx) => {
    concepts = loadConcepts(config.conceptsDir);
    updateStatus(ctx);
  });

  // --- /concepts command: quick list ---

  pi.registerCommand("concepts", {
    description: "List defined concepts in this project's ontology",
    handler: async (_args, ctx) => {
      concepts = loadConcepts(config.conceptsDir);

      if (concepts.length === 0) {
        ctx.ui.notify(
          `No concepts defined yet. Use /define to create one, or /suggest-concepts to discover them.`,
          "info"
        );
        return;
      }

      const theme = ctx.ui.theme;
      const lines: string[] = [
        theme.bold(`Concepts (${config.conceptsDir})`),
        "",
      ];

      for (const c of concepts) {
        const status = c.status === "draft" ? theme.fg("warning", " [draft]") : "";
        lines.push(`${theme.fg("accent", c.name)}${status}`);
        lines.push(`  ${theme.fg("muted", c.summary)}`);
        if (c.related.length > 0) {
          lines.push(`  ${theme.fg("dim", "→ " + c.related.join(", "))}`);
        }
        lines.push("");
      }

      ctx.ui.setWidget("concepts-list", lines);

      const unsub = ctx.ui.onTerminalInput(() => {
        ctx.ui.setWidget("concepts-list", undefined);
        unsub();
        return { consume: true };
      });
    },
  });
}
