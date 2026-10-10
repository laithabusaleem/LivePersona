export type Meta = {
  name: string;
  version: string;
  capabilities: {
    demoMode: boolean;
    llmConfigured: boolean;
    provider: string;
    sttAvailable: boolean;
    ttsAvailable: boolean;
    lipSyncAvailable: boolean;
    sessionLogging: boolean;
  };
  identity: {
    displayName: string;
    synthetic: true;
    likenessAuthorized: boolean;
    voiceCloneAuthorized: boolean;
    disclaimer: string;
  };
  avatarFeatures: Record<string, string>;
};

export async function fetchMeta(): Promise<Meta> {
  const res = await fetch("/api/meta");
  if (!res.ok) throw new Error("Failed to load meta");
  return res.json();
}

export async function* streamChat(args: {
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: number;
  }>;
  epoch: number;
  signal: AbortSignal;
}): AsyncGenerator<{
  type: "token" | "done" | "error";
  text?: string;
  error?: string;
  epoch: number;
}> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: args.messages, epoch: args.epoch }),
    signal: args.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Chat failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      yield JSON.parse(data);
    }
  }
}
