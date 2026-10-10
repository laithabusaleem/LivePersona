import { describe, expect, it } from "vitest";
import {
  ConversationController,
  demoDialogueStream,
  PERCENTILE_MIN_SAMPLES,
  percentile,
  buildMetricReport,
} from "../src/index.js";

describe("ConversationController", () => {
  it("completes a typed demo turn", async () => {
    const ctrl = new ConversationController(demoDialogueStream);
    await ctrl.submitUserText("hello there");
    const snap = ctrl.snapshot();
    expect(snap.state).toBe("idle");
    expect(snap.messages.some((m) => m.role === "user")).toBe(true);
    expect(
      snap.messages.some(
        (m) => m.role === "assistant" && m.content.toLowerCase().includes("hello"),
      ),
    ).toBe(true);
    expect(snap.samples[0]?.timeToFirstTokenMs).toBeGreaterThanOrEqual(0);
  });

  it("interrupt cancels obsolete playback epoch", async () => {
    let resolveGate: (() => void) | undefined;
    const gate = new Promise<void>((r) => {
      resolveGate = r;
    });

    const slowStream = async function* (args: {
      messages: { role: string; content: string }[];
      epoch: number;
      signal: AbortSignal;
    }) {
      yield { type: "token" as const, text: "Start ", epoch: args.epoch };
      await gate;
      if (args.signal.aborted) return;
      yield {
        type: "token" as const,
        text: "SHOULD_NOT_APPEAR",
        epoch: args.epoch,
      };
      yield { type: "done" as const, epoch: args.epoch };
    };

    const ctrl = new ConversationController(slowStream as never);
    const pending = ctrl.submitUserText("long answer please");
    // Wait until generating
    await new Promise((r) => setTimeout(r, 20));
    expect(ctrl.getState()).toBe("generating");
    const epochBefore = ctrl.snapshot().epoch;
    ctrl.interrupt("test");
    expect(ctrl.snapshot().epoch).toBeGreaterThan(epochBefore);
    resolveGate?.();
    await pending;
    const text = ctrl.snapshot().messages
      .filter((m) => m.role === "assistant")
      .map((m) => m.content)
      .join(" ");
    expect(text).not.toContain("SHOULD_NOT_APPEAR");
    expect(ctrl.getState()).toBe("idle");
  });

  it("discards stale chunks from older epochs", async () => {
    const ctrl = new ConversationController(async function* (args) {
      yield { type: "token", text: "old-", epoch: args.epoch - 1 };
      yield { type: "token", text: "new", epoch: args.epoch };
      yield { type: "done", epoch: args.epoch };
    });
    await ctrl.submitUserText("hi");
    const assistant = ctrl.snapshot().messages.find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("new");
  });
});

describe("metrics", () => {
  it("withholds percentiles below sample threshold", () => {
    expect(percentile([1, 2, 3], 50)).toBeNull();
    expect(PERCENTILE_MIN_SAMPLES).toBe(20);
    const report = buildMetricReport(
      Array.from({ length: 5 }, () => ({ totalResponseMs: 100 })),
    );
    expect(report.percentilesAvailable).toBe(false);
    expect(report.p50.totalResponseMs).toBeNull();
  });

  it("reports percentiles when enough samples exist", () => {
    const samples = Array.from({ length: 20 }, (_, i) => ({
      totalResponseMs: (i + 1) * 10,
    }));
    const report = buildMetricReport(samples);
    expect(report.percentilesAvailable).toBe(true);
    expect(report.p50.totalResponseMs).not.toBeNull();
  });
});
