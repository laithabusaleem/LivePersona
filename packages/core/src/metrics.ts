import type { TurnMetrics } from "./types.js";

/** Minimum samples required before percentiles are reported. */
export const PERCENTILE_MIN_SAMPLES = 20;

export type MetricSample = {
  timeToFirstTranscriptionMs?: number;
  timeToFirstTokenMs?: number;
  timeToFirstAudioMs?: number;
  totalResponseMs?: number;
  cancelLatencyMs?: number;
};

export function sampleFromTurn(turn: TurnMetrics): MetricSample {
  const sample: MetricSample = {};
  if (turn.tFirstTranscription !== undefined) {
    sample.timeToFirstTranscriptionMs =
      turn.tFirstTranscription - turn.tStart;
  }
  if (turn.tFirstToken !== undefined) {
    sample.timeToFirstTokenMs = turn.tFirstToken - turn.tStart;
  }
  if (turn.tFirstAudio !== undefined) {
    sample.timeToFirstAudioMs = turn.tFirstAudio - turn.tStart;
  }
  if (turn.tEnd !== undefined) {
    sample.totalResponseMs = turn.tEnd - turn.tStart;
  }
  if (
    turn.tCancelRequested !== undefined &&
    turn.tCancelCompleted !== undefined
  ) {
    sample.cancelLatencyMs = turn.tCancelCompleted - turn.tCancelRequested;
  }
  return sample;
}

export function percentile(
  values: number[],
  p: number,
): number | null {
  if (values.length < PERCENTILE_MIN_SAMPLES) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx]!;
}

export type MetricReport = {
  sampleCount: number;
  percentilesAvailable: boolean;
  procedure: string;
  means: Record<string, number | null>;
  p50: Record<string, number | null>;
  p95: Record<string, number | null>;
};

export function buildMetricReport(samples: MetricSample[]): MetricReport {
  const procedure =
    `Percentiles are computed only when sampleCount >= ${PERCENTILE_MIN_SAMPLES}. ` +
    "Timestamps are wall-clock milliseconds from turn start using Date.now() at each event. " +
    "Browser STT/TTS jitter and network latency are included when those paths are used.";

  const keys = [
    "timeToFirstTranscriptionMs",
    "timeToFirstTokenMs",
    "timeToFirstAudioMs",
    "totalResponseMs",
    "cancelLatencyMs",
  ] as const;

  const means: Record<string, number | null> = {};
  const p50: Record<string, number | null> = {};
  const p95: Record<string, number | null> = {};

  for (const key of keys) {
    const values = samples
      .map((s) => s[key])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    means[key] =
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
    p50[key] = percentile(values, 50);
    p95[key] = percentile(values, 95);
  }

  return {
    sampleCount: samples.length,
    percentilesAvailable: samples.length >= PERCENTILE_MIN_SAMPLES,
    procedure,
    means,
    p50,
    p95,
  };
}
