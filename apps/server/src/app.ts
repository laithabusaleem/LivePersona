import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import type { ChatMessage } from "@livepersona/core";
import type { AppConfig } from "./config.js";
import { llmConfigured } from "./config.js";
import { streamDialogue } from "./dialogue.js";
import type { SessionStore } from "./sessions.js";

export function createApp(config: AppConfig, sessions: SessionStore | null) {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/meta", (_req, res) => {
    res.json({
      name: "LivePersona",
      version: "0.1.0",
      capabilities: {
        demoMode: !llmConfigured(config),
        llmConfigured: llmConfigured(config),
        provider: llmConfigured(config) ? "openai" : "demo",
        sttAvailable: true, // browser Web Speech when supported
        ttsAvailable: true, // browser SpeechSynthesis when supported
        lipSyncAvailable: false,
        sessionLogging: Boolean(config.sessionLogging && sessions),
      },
      identity: {
        displayName: "LivePersona Demo",
        synthetic: true,
        likenessAuthorized: false,
        voiceCloneAuthorized: false,
        disclaimer:
          "This avatar is synthetic. It is not a real person or official representative.",
      },
      avatarFeatures: {
        staticAvatar: "implemented",
        speakingPulse: "implemented",
        browserTtsHeuristic: "implemented (not photoreal lip-sync)",
        duixPhotorealLipSync: "not implemented / unverified external SDK",
      },
    });
  });

  app.post("/api/chat", async (req, res) => {
    const messages = (req.body?.messages ?? []) as ChatMessage[];
    const epoch = Number(req.body?.epoch ?? 0);
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // Abort only when the *response* closes (client disconnect).
    // Do NOT listen to req "close" — it fires when the JSON body finishes reading
    // and would cancel generation before any tokens are written.
    const abort = new AbortController();
    const onResponseClose = () => abort.abort();
    res.on("close", onResponseClose);

    try {
      for await (const chunk of streamDialogue(config, {
        messages,
        epoch,
        signal: abort.signal,
      })) {
        if (abort.signal.aborted) break;
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        if (chunk.type === "done" || chunk.type === "error") break;
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            error: err instanceof Error ? err.message : String(err),
            epoch,
          })}\n\n`,
        );
      }
    } finally {
      res.off("close", onResponseClose);
      if (!res.writableEnded) res.end();
    }
  });

  app.post("/api/chat/sync", async (req, res) => {
    const messages = (req.body?.messages ?? []) as ChatMessage[];
    const epoch = Number(req.body?.epoch ?? 1);
    const abort = new AbortController();
    let text = "";
    try {
      for await (const chunk of streamDialogue(config, {
        messages,
        epoch,
        signal: abort.signal,
      })) {
        if (chunk.type === "token" && chunk.text) text += chunk.text;
        if (chunk.type === "error") {
          res.status(502).json({ error: chunk.error, provider: "failed" });
          return;
        }
      }
      res.json({
        text,
        provider: llmConfigured(config) ? "openai" : "demo",
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get("/api/sessions", (_req, res) => {
    if (!sessions || !config.sessionLogging) {
      res.status(403).json({ error: "Session logging is disabled" });
      return;
    }
    res.json({ sessions: sessions.list() });
  });

  app.post("/api/sessions", (req, res) => {
    if (!sessions || !config.sessionLogging) {
      res.status(403).json({ error: "Session logging is disabled" });
      return;
    }
    const entry = {
      id: `sess_${randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      messages: req.body?.messages ?? [],
    };
    sessions.save(entry);
    res.status(201).json({ session: entry });
  });

  app.get("/api/sessions/:id", (req, res) => {
    if (!sessions || !config.sessionLogging) {
      res.status(403).json({ error: "Session logging is disabled" });
      return;
    }
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ session });
  });

  app.delete("/api/sessions/:id", (req, res) => {
    if (!sessions || !config.sessionLogging) {
      res.status(403).json({ error: "Session logging is disabled" });
      return;
    }
    const ok = sessions.delete(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  });

  return app;
}
