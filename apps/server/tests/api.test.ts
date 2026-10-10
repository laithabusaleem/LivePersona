import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

describe("API", () => {
  const config = loadConfig({
    MODEL_PROVIDER: "demo",
    SESSION_LOGGING: "false",
    CORS_ORIGIN: "*",
  });
  const app = createApp(config, null);
  let server: ReturnType<typeof app.listen>;
  let base = "";

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          base = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("meta shows demo mode without API key", async () => {
    const res = await fetch(`${base}/api/meta`);
    const body = (await res.json()) as {
      capabilities: { demoMode: boolean; llmConfigured: boolean; lipSyncAvailable: boolean };
    };
    expect(body.capabilities.demoMode).toBe(true);
    expect(body.capabilities.llmConfigured).toBe(false);
    expect(body.capabilities.lipSyncAvailable).toBe(false);
  });

  it("sync chat works in demo mode", async () => {
    const res = await fetch(`${base}/api/chat/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        epoch: 1,
        messages: [
          {
            id: "m1",
            role: "user",
            content: "hello",
            createdAt: Date.now(),
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { text: string; provider: string };
    expect(body.provider).toBe("demo");
    expect(body.text.toLowerCase()).toContain("hello");
  });

  it("reports sessions disabled", async () => {
    const res = await fetch(`${base}/api/sessions`);
    expect(res.status).toBe(403);
  });
});
