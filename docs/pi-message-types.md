# Pi Message & Content Types

> From `@mariozechner/pi-ai` and `@mariozechner/pi-agent-core` type definitions.

## Content Types

```typescript
interface TextContent {
  type: "text";
  text: string;
  textSignature?: string;
}

interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

interface ThinkingContent {
  type: "thinking";
  thinking: string;
  thinkingSignature?: string;
}

interface ToolCall {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, any>;
}
```

## LLM Messages (`Message`)

```typescript
type Message = UserMessage | AssistantMessage | ToolResultMessage;

interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp: number;
}

interface AssistantMessage {
  role: "assistant";
  content: (TextContent | ThinkingContent | ToolCall)[];
  api: Api;
  provider: Provider;
  model: string;
  usage: Usage;
  stopReason: StopReason;
  timestamp: number;
}

interface ToolResultMessage<TDetails = any> {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: (TextContent | ImageContent)[];
  details?: TDetails;
  isError: boolean;
  timestamp: number;
}
```

## AgentMessage

```typescript
// Union of LLM messages + any custom messages registered via declaration merging
type AgentMessage = Message | CustomAgentMessages[keyof CustomAgentMessages];
```

In practice, `AgentMessage` is usually one of `UserMessage`, `AssistantMessage`, or `ToolResultMessage`.

## Extracting text from messages

```typescript
function extractText(msg: AgentMessage): string {
  if (!("role" in msg)) return "";

  if (msg.role === "user") {
    if (typeof msg.content === "string") return msg.content;
    return msg.content
      .filter((c): c is TextContent => c.type === "text")
      .map(c => c.text)
      .join("\n");
  }

  if (msg.role === "assistant") {
    return msg.content
      .filter((c): c is TextContent => c.type === "text")
      .map(c => c.text)
      .join("\n");
  }

  if (msg.role === "toolResult") {
    return msg.content
      .filter((c): c is TextContent => c.type === "text")
      .map(c => c.text)
      .join("\n");
  }

  return "";
}
```

## Event message shapes

- `message_end` event: `{ message: AgentMessage }` — the completed message
- `tool_result` event: `{ content: (TextContent | ImageContent)[], toolName: string, isError: boolean, ... }`
- `context` event: `{ messages: AgentMessage[] }` — full conversation for injection
- `turn_end` event: `{ message: AgentMessage, toolResults: ToolResultMessage[] }`

## AgentToolResult (tool execute return type)

```typescript
interface AgentToolResult<T> {
  content: (TextContent | ImageContent)[];
  details: T;
}
```

Helper for simple text results:
```typescript
function textResult(text: string): AgentToolResult<undefined> {
  return {
    content: [{ type: "text", text }],
    details: undefined,
  };
}
```
