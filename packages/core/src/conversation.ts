import {
  buildMetricReport,
  sampleFromTurn,
  type MetricReport,
  type MetricSample,
} from "./metrics.js";
import type {
  ChatMessage,
  ConversationState,
  DialogueChunk,
  TurnMetrics,
} from "./types.js";

export type ConversationListener = (snapshot: ConversationSnapshot) => void;

export type ConversationSnapshot = {
  state: ConversationState;
  messages: ChatMessage[];
  epoch: number;
  currentAssistantText: string;
  error: string | null;
  metrics: TurnMetrics[];
  samples: MetricSample[];
  report: MetricReport;
};

export type DialogueStreamer = (args: {
  messages: ChatMessage[];
  epoch: number;
  signal: AbortSignal;
}) => AsyncGenerator<DialogueChunk>;

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Framework-independent conversation controller with epoch-based cancellation.
 * Safe for web, desktop, or future mobile clients.
 */
export class ConversationController {
  private state: ConversationState = "idle";
  private messages: ChatMessage[] = [];
  private epoch = 0;
  private currentAssistantText = "";
  private error: string | null = null;
  private metrics: TurnMetrics[] = [];
  private samples: MetricSample[] = [];
  private listeners = new Set<ConversationListener>();
  private abort: AbortController | null = null;
  private activeTurn: TurnMetrics | null = null;

  constructor(
    private readonly streamDialogue: DialogueStreamer,
    private readonly now: () => number = () => Date.now(),
  ) {}

  subscribe(listener: ConversationListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): ConversationSnapshot {
    return {
      state: this.state,
      messages: [...this.messages],
      epoch: this.epoch,
      currentAssistantText: this.currentAssistantText,
      error: this.error,
      metrics: [...this.metrics],
      samples: [...this.samples],
      report: buildMetricReport(this.samples),
    };
  }

  getState(): ConversationState {
    return this.state;
  }

  setState(next: ConversationState): void {
    this.state = next;
    this.emit();
  }

  /** Begin listening (mic open). */
  startListening(): void {
    if (this.state === "generating" || this.state === "speaking") {
      this.interrupt("User started listening while assistant active");
    }
    this.error = null;
    this.setState("listening");
  }

  markTranscribing(): void {
    this.setState("transcribing");
    if (this.activeTurn && this.activeTurn.tFirstTranscription === undefined) {
      this.activeTurn.tFirstTranscription = this.now();
      this.emit();
    }
  }

  markFirstAudio(): void {
    if (this.activeTurn && this.activeTurn.tFirstAudio === undefined) {
      this.activeTurn.tFirstAudio = this.now();
      this.emit();
    }
  }

  markSpeaking(): void {
    if (this.state === "interrupted") return;
    this.setState("speaking");
  }

  /**
   * Interrupt generation/speech. Increments epoch so stale chunks are ignored.
   */
  interrupt(reason = "User interrupt"): void {
    const tCancel = this.now();
    if (this.activeTurn) {
      this.activeTurn.cancelled = true;
      this.activeTurn.tCancelRequested = tCancel;
    }
    this.abort?.abort();
    this.abort = null;
    this.epoch += 1;
    this.currentAssistantText = "";
    this.error = null;

    // Mark last incomplete assistant message cancelled if any
    const last = this.messages[this.messages.length - 1];
    if (last?.role === "assistant" && !last.content) {
      last.cancelled = true;
      last.content = `[interrupted: ${reason}]`;
    }

    this.setState("interrupted");

    if (this.activeTurn) {
      this.activeTurn.tCancelCompleted = this.now();
      this.activeTurn.tEnd = this.activeTurn.tCancelCompleted;
      this.finalizeTurn(this.activeTurn);
      this.activeTurn = null;
    }

    this.setState("recovering");
    this.setState("idle");
  }

  /** Submit a user utterance (typed or transcribed). */
  async submitUserText(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    // New user turn supersedes any in-flight assistant work
    if (
      this.state === "generating" ||
      this.state === "speaking" ||
      this.state === "listening"
    ) {
      this.interrupt("Superseded by new user message");
    }

    this.error = null;
    this.epoch += 1;
    const epoch = this.epoch;
    const turnId = id("turn");
    const turn: TurnMetrics = {
      turnId,
      epoch,
      tStart: this.now(),
      cancelled: false,
    };
    this.activeTurn = turn;

    this.messages.push({
      id: id("msg"),
      role: "user",
      content: trimmed,
      createdAt: this.now(),
    });

    const assistantId = id("msg");
    this.messages.push({
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: this.now(),
      epoch,
    });
    this.currentAssistantText = "";
    this.setState("generating");

    this.abort = new AbortController();
    try {
      for await (const chunk of this.streamDialogue({
        messages: this.messages.filter((m) => !m.cancelled),
        epoch,
        signal: this.abort.signal,
      })) {
        if (chunk.epoch !== this.epoch) {
          // Stale — discard
          continue;
        }
        if (chunk.type === "error") {
          this.error = chunk.error ?? "Dialogue error";
          this.setState("error");
          break;
        }
        if (chunk.type === "token" && chunk.text) {
          if (turn.tFirstToken === undefined) {
            turn.tFirstToken = this.now();
          }
          this.currentAssistantText += chunk.text;
          const msg = this.messages.find((m) => m.id === assistantId);
          if (msg) msg.content = this.currentAssistantText;
          this.emit();
        }
        if (chunk.type === "done") {
          break;
        }
      }

      if (this.epoch !== epoch) {
        return; // interrupted
      }

      const msg = this.messages.find((m) => m.id === assistantId);
      if (msg && !msg.content) {
        msg.content = this.currentAssistantText || "(empty response)";
      }
      turn.tEnd = this.now();
      this.finalizeTurn(turn);
      this.activeTurn = null;
      this.setState("idle");
    } catch (err) {
      if (this.abort?.signal.aborted || this.epoch !== epoch) {
        return;
      }
      this.error = err instanceof Error ? err.message : String(err);
      turn.tEnd = this.now();
      this.finalizeTurn(turn);
      this.activeTurn = null;
      this.setState("error");
    } finally {
      if (this.epoch === epoch) {
        this.abort = null;
      }
    }
  }

  clearError(): void {
    this.error = null;
    if (this.state === "error") this.setState("idle");
  }

  reset(): void {
    this.interrupt("Reset");
    this.messages = [];
    this.metrics = [];
    this.samples = [];
    this.currentAssistantText = "";
    this.error = null;
    this.setState("idle");
  }

  private finalizeTurn(turn: TurnMetrics): void {
    this.metrics.push(turn);
    this.samples.push(sampleFromTurn(turn));
    this.emit();
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
  }
}

/** Deterministic demo dialogue for offline use. */
export async function* demoDialogueStream(args: {
  messages: ChatMessage[];
  epoch: number;
  signal: AbortSignal;
}): AsyncGenerator<DialogueChunk> {
  const lastUser = [...args.messages].reverse().find((m) => m.role === "user");
  const q = lastUser?.content.toLowerCase() ?? "";
  let reply =
    "I'm LivePersona, a labeled synthetic assistant. Ask me about interruption handling, privacy, or how the demo mode works.";
  if (q.includes("interrupt")) {
    reply =
      "Interruption increments a response epoch, aborts generation, and stops speech so stale audio never plays.";
  } else if (q.includes("privacy") || q.includes("mic")) {
    reply =
      "Microphone access is request-based, sessions are not recorded by default, and synthetic identity is always disclosed.";
  } else if (q.includes("hello") || q.includes("hi")) {
    reply = "Hello! Type or speak a question. You can interrupt me anytime.";
  } else if (q.length > 0) {
    reply = `You said: “${lastUser!.content.slice(0, 180)}”. This reply came from the local demo dialogue provider — no cloud API was used.`;
  }

  // Simulate token streaming with abort checks
  const words = reply.split(/(\s+)/);
  for (const word of words) {
    if (args.signal.aborted) {
      return;
    }
    yield { type: "token", text: word, epoch: args.epoch };
    await delay(18);
  }
  yield { type: "done", epoch: args.epoch };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
