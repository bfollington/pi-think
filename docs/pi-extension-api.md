# Pi Extension API Reference

> Extracted from `@mariozechner/pi-coding-agent` type definitions (globally installed via mise node 20.14.0).

## Extension Entry Point

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function myExtension(pi: ExtensionAPI) {
  // sync or async — both work
}
```

Extensions are loaded via `jiti` (no compilation). Place in `.pi/extensions/` as `*.ts` or `*/index.ts`.

## Tool Registration

```typescript
pi.registerTool<TParams extends TSchema, TDetails = unknown>({
  name: string;
  label: string;           // display label in TUI
  description: string;
  parameters: TParams;     // @sinclair/typebox schema
  execute(
    toolCallId: string,
    params: Static<TParams>,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
    ctx: ExtensionContext
  ): Promise<AgentToolResult<TDetails>>;
  renderCall?: (args, theme) => Component;
  renderResult?: (result, options, theme) => Component;
});
```

**Important**: The execute signature is `(toolCallId, params, signal, onUpdate, ctx)` — NOT `(args, ctx)` as shown in SPEC.md examples. The SPEC.md tool examples need adjustment.

### AgentToolResult

The return type from execute (defined in `@mariozechner/pi-agent-core`):

```typescript
interface AgentToolResult<T> {
  content: (TextContent | ImageContent)[];
  details: T;
}
```

Tools return content blocks, not a bare string:

```typescript
return {
  content: [{ type: "text", text: "result here" }],
  details: undefined,
};
```

### TypeBox Schemas

TypeBox is available from pi's dependency tree. Import from `@sinclair/typebox`:

```typescript
import { Type, type Static } from "@sinclair/typebox";

const params = Type.Object({
  task_id: Type.String({ description: "The task ID" }),
  session_id: Type.String({ description: "Your session identifier" }),
});
```

Common types: `Type.Object`, `Type.String`, `Type.Number`, `Type.Boolean`, `Type.Optional`, `Type.Union`, `Type.Literal`, `Type.Array`.

## Events

### Session Lifecycle
| Event | Data | Return |
|-------|------|--------|
| `session_start` | `SessionStartEvent` | void |
| `session_shutdown` | — | void |
| `session_before_compact` / `session_compact` | compact events | void |
| `session_before_switch` / `session_switch` | session path | void |
| `session_before_fork` / `session_fork` | fork events | void |

### Agent Loop
| Event | Data | Return |
|-------|------|--------|
| `before_agent_start` | `BeforeAgentStartEvent` | `{ systemPrompt? }` |
| `agent_start` / `agent_end` | — | void |
| `turn_start` / `turn_end` | turn events | void |
| `message_start` / `message_update` / `message_end` | message events | void |

### Tool Events
| Event | Data | Return |
|-------|------|--------|
| `tool_call` | `ToolCallEvent` | `{ block?: boolean }` |
| `tool_result` | `ToolResultEvent` | `{ result? }` |
| `tool_execution_start/update/end` | execution events | void |

### Context & Input
| Event | Data | Return |
|-------|------|--------|
| `context` | `{ messages: AgentMessage[] }` | `{ messages? }` |
| `input` | user input event | transform/handle |
| `user_bash` | bash command event | intercept |

## ExtensionContext (available in all handlers)

```typescript
interface ExtensionContext {
  ui: ExtensionUIContext;
  hasUI: boolean;
  cwd: string;
  sessionManager: ReadonlySessionManager;
  model: Model<any> | undefined;
  isIdle(): boolean;
  abort(): void;
  shutdown(): void;
  getContextUsage(): ContextUsage | undefined;
  compact(options?: CompactOptions): void;
  getSystemPrompt(): string;
}
```

## Command Registration

```typescript
pi.registerCommand("name", {
  description?: string;
  getArgumentCompletions?: (prefix: string) => AutocompleteItem[] | null;
  handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
});
```

`ExtensionCommandContext` extends `ExtensionContext` with:
- `waitForIdle()`, `newSession()`, `fork()`, `navigateTree()`, `switchSession()`, `reload()`

## Keyboard Shortcuts

```typescript
pi.registerShortcut("ctrl+x", {
  description?: string;
  handler: (ctx: ExtensionContext) => Promise<void> | void;
});
```

## UI Methods (ctx.ui)

```typescript
interface ExtensionUIContext {
  // Dialogs
  select(title, options, opts?): Promise<string | undefined>;
  confirm(title, message, opts?): Promise<boolean>;
  input(title, placeholder?, opts?): Promise<string | undefined>;
  editor(title, prefill?): Promise<string | undefined>;
  notify(message, type?): void;

  // Status & Widgets
  setStatus(key: string, text: string | undefined): void;
  setWidget(key: string, content: string[] | undefined | factory, options?): void;
  setWorkingMessage(message?: string): void;
  setTitle(title: string): void;
  setFooter(factory): void;
  setHeader(factory): void;

  // Editor manipulation
  pasteToEditor(text): void;
  setEditorText(text): void;
  getEditorText(): string;

  // Theme
  readonly theme: Theme;
  setTheme(theme): { success; error? };
}
```

## Tool Call Blocking (Plan Mode)

The `tool_call` event can prevent tool execution:

```typescript
pi.on("tool_call", (event, ctx) => {
  if (planModeActive && event.toolName === "write") {
    return { block: true };
  }
});
```

## Message Types

Messages in the `context` event are `AgentMessage[]`. Built-in tool schemas:

- **bash**: `{ command: string, timeout?: number }`
- **read**: `{ path: string, offset?: number, limit?: number }`
- **write**: `{ path: string, content: string }`
- **edit**: `{ path: string, old_string: string, new_string: string }`
- **grep**: `{ pattern: string, path?: string, glob?: string, ... }`

## Exec (run subprocesses)

```typescript
pi.exec(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>;
```

## Shared Event Bus

Extensions can communicate via `pi.events`:

```typescript
pi.events.emit("custom_event", data);
pi.events.on("custom_event", handler);
```
