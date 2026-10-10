import { useEffect, useMemo, useRef, useState } from "react";
import {
  ConversationController,
  type ConversationSnapshot,
} from "@livepersona/core";
import { fetchMeta, streamChat, type Meta } from "./api";
import { StaticAvatar } from "./components/StaticAvatar";
import {
  listenOnce,
  queryMicPermission,
  speakText,
  speechRecognitionSupported,
  speechSynthesisSupported,
  type MicPermission,
} from "./speech";

export function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [snap, setSnap] = useState<ConversationSnapshot | null>(null);
  const [input, setInput] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [micPermission, setMicPermission] = useState<MicPermission>("unknown");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);
  const speakCancel = useRef<(() => void) | null>(null);
  const listenStop = useRef<(() => void) | null>(null);
  const lastSpokenEpoch = useRef(-1);

  const controller = useMemo(
    () =>
      new ConversationController(async function* (args) {
        yield* streamChat({
          messages: args.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })),
          epoch: args.epoch,
          signal: args.signal,
        });
      }),
    [],
  );

  useEffect(() => {
    return controller.subscribe(setSnap);
  }, [controller]);

  useEffect(() => {
    void fetchMeta()
      .then(setMeta)
      .catch(() =>
        setMeta({
          name: "LivePersona",
          version: "0.1.0",
          capabilities: {
            demoMode: true,
            llmConfigured: false,
            provider: "demo",
            sttAvailable: speechRecognitionSupported(),
            ttsAvailable: speechSynthesisSupported(),
            lipSyncAvailable: false,
            sessionLogging: false,
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
            duixPhotorealLipSync: "not implemented",
          },
        }),
      );
    void queryMicPermission().then(setMicPermission);
  }, []);

  // Speak assistant reply when a turn completes (idle) with new content
  useEffect(() => {
    if (!snap || !ttsEnabled || !speechSynthesisSupported()) return;
    if (snap.state !== "idle") return;
    const last = [...snap.messages].reverse().find((m) => m.role === "assistant");
    if (!last || last.cancelled || !last.content) return;
    if (last.epoch === undefined || last.epoch === lastSpokenEpoch.current) return;
    lastSpokenEpoch.current = last.epoch;
    speakCancel.current?.();
    controller.markSpeaking();
    controller.markFirstAudio();
    setSpeaking(true);
    speakCancel.current = speakText(
      last.content,
      () => setSpeaking(true),
      () => {
        setSpeaking(false);
        if (controller.getState() === "speaking") {
          controller.setState("idle");
        }
      },
    ).cancel;
  }, [snap, ttsEnabled, controller]);

  function handleInterrupt() {
    listenStop.current?.();
    setListening(false);
    speakCancel.current?.();
    speakCancel.current = null;
    setSpeaking(false);
    window.speechSynthesis?.cancel();
    controller.interrupt("User pressed Stop / Interrupt");
  }

  async function sendText(text: string) {
    setSttError(null);
    speakCancel.current?.();
    setSpeaking(false);
    window.speechSynthesis?.cancel();
    await controller.submitUserText(text);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fromDom = new FormData(form).get("message");
    const text = String(fromDom ?? input).trim();
    if (!text) return;
    setInput("");
    await sendText(text);
  }

  async function onPushToTalk() {
    if (!speechRecognitionSupported()) {
      setSttError(
        "Speech recognition unavailable. Typed dialogue still works.",
      );
      return;
    }
    setSttError(null);
    handleInterrupt();
    controller.startListening();
    setListening(true);
    const { promise, stop } = listenOnce();
    listenStop.current = stop;
    controller.markTranscribing();
    const result = await promise;
    setListening(false);
    listenStop.current = null;
    if (!result.ok) {
      setSttError(`STT failed: ${result.error}. You can still type.`);
      controller.setState("idle");
      void queryMicPermission().then(setMicPermission);
      return;
    }
    await sendText(result.text);
  }

  const state = snap?.state ?? "idle";

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>LivePersona</h1>
          <p>Interruption-aware synthetic conversation avatar</p>
        </div>
        <div className="row">
          <span className="badge warn">SYNTHETIC IDENTITY</span>
          <span className={`badge ${meta?.capabilities.demoMode ? "ok" : ""}`}>
            {meta
              ? meta.capabilities.demoMode
                ? "demo mode"
                : `LLM · ${meta.capabilities.provider}`
              : "connecting…"}
          </span>
        </div>
      </header>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <strong>{meta?.identity.disclaimer}</strong>
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>
          Photoreal audio-driven lip synchronization is <em>not</em> included.
          Static avatar mode is intentional for the no-key demo. A Duix-style
          mobile SDK integration remains unverified and is not bundled.
        </p>
      </div>

      <div className="layout">
        <aside className="panel">
          <StaticAvatar
            speaking={speaking || state === "speaking"}
            name={meta?.identity.displayName ?? "LivePersona"}
          />
          <div className="row" style={{ marginTop: "0.75rem" }}>
            <span className="badge">state: {state}</span>
            <span className="badge">mic: {micPermission}</span>
            <span className="badge">
              STT: {speechRecognitionSupported() ? "browser" : "unavailable"}
            </span>
            <span className="badge">
              TTS: {speechSynthesisSupported() ? "browser" : "unavailable"}
            </span>
            <span className="badge danger">lip-sync: off</span>
          </div>
          <div className="field" style={{ marginTop: "0.75rem" }}>
            <label>
              <input
                type="checkbox"
                checked={ttsEnabled}
                onChange={(e) => setTtsEnabled(e.target.checked)}
              />{" "}
              Speak responses (browser TTS)
            </label>
          </div>
          <p className="muted">
            Session recording is off by default. Enable{" "}
            <code>SESSION_LOGGING=true</code> on the server only if you want
            opt-in logs with delete support.
          </p>
        </aside>

        <section className="panel">
          <h2>Conversation</h2>
          <div className="chat" aria-live="polite">
            {(snap?.messages ?? []).map((m) => (
              <div
                key={m.id}
                className={`bubble ${m.role}${m.cancelled ? " cancelled" : ""}`}
              >
                <strong>{m.role}</strong>
                <div>{m.content || (m.role === "assistant" ? "…" : "")}</div>
              </div>
            ))}
            {snap?.messages.length === 0 && (
              <p className="muted">
                Try: “Hello”, “How does interrupt work?”, or “Tell me about privacy”.
              </p>
            )}
          </div>

          {snap?.error && <div className="error">{snap.error}</div>}
          {sttError && <div className="error">{sttError}</div>}

          <form className="composer" onSubmit={(e) => void onSubmit(e)}>
            <textarea
              name="message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              aria-label="Message"
            />
            <div className="row">
              <button className="btn" type="submit" disabled={state === "generating"}>
                Send
              </button>
              <button
                className="btn secondary"
                type="button"
                disabled={listening}
                onClick={() => void onPushToTalk()}
              >
                {listening ? "Listening…" : "Push to talk"}
              </button>
              <button
                className="btn danger"
                type="button"
                onClick={handleInterrupt}
              >
                Stop / Interrupt
              </button>
            </div>
          </form>

          <h3 style={{ marginTop: "1rem" }}>Session metrics</h3>
          <div className="metrics">
            <div>samples: {snap?.report.sampleCount ?? 0}</div>
            <div>
              percentiles:{" "}
              {snap?.report.percentilesAvailable
                ? "available"
                : "withheld (need ≥20 samples)"}
            </div>
            <div>
              mean time-to-first-token:{" "}
              {formatMs(snap?.report.means.timeToFirstTokenMs)}
            </div>
            <div>
              mean total response: {formatMs(snap?.report.means.totalResponseMs)}
            </div>
            <div>
              mean cancel latency: {formatMs(snap?.report.means.cancelLatencyMs)}
            </div>
            <p className="muted" style={{ margin: "0.4rem 0 0" }}>
              {snap?.report.procedure}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function formatMs(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "n/a";
  return `${Math.round(v)} ms`;
}
