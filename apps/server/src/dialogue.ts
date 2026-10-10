import type { ChatMessage, DialogueChunk } from "@livepersona/core";
import { demoDialogueStream } from "@livepersona/core";
import type { AppConfig } from "./config.js";
import { llmConfigured } from "./config.js";

export async function* streamDialogue(
  config: AppConfig,
  args: {
    messages: ChatMessage[];
    epoch: number;
    signal: AbortSignal;
  },
): AsyncGenerator<DialogueChunk> {
  if (!llmConfigured(config)) {
    yield* demoDialogueStream(args);
    return;
  }

  try {
    yield* openaiStream(config, args);
  } catch (err) {
    if (args.signal.aborted) return;
    yield {
      type: "error",
      error:
        err instanceof Error
          ? `LLM failed: ${err.message}. Falling back is handled by client retry to demo if desired.`
          : "LLM failed",
      epoch: args.epoch,
    };
  }
}

async function* openaiStream(
  config: AppConfig,
  args: {
    messages: ChatMessage[];
    epoch: number;
    signal: AbortSignal;
  },
): AsyncGenerator<DialogueChunk> {
  const system = {
    role: "system",
    content:
      "You are LivePersona, a clearly labeled synthetic interactive assistant. " +
      "Never claim to be a real human or official representative. Keep answers concise.",
  };
  const messages = [
    system,
    ...args.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content })),
  ];

  const res = await fetch(`${config.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.openaiModel,
      stream: true,
      messages,
      temperature: 0.6,
    }),
    signal: args.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (args.signal.aborted) {
      await reader.cancel();
      return;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") {
        yield { type: "done", epoch: args.epoch };
        return;
      }
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const token = json.choices?.[0]?.delta?.content;
        if (token) {
          yield { type: "token", text: token, epoch: args.epoch };
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
  yield { type: "done", epoch: args.epoch };
}
