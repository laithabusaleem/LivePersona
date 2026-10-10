export type MicPermission = "unknown" | "granted" | "denied" | "prompt";

export function speechRecognitionSupported(): boolean {
  return Boolean(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition,
  );
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export async function queryMicPermission(): Promise<MicPermission> {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return status.state as MicPermission;
  } catch {
    return "unknown";
  }
}

type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function createRecognition(): RecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export type ListenResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

/** One-shot browser speech recognition. */
export function listenOnce(lang = "en-US"): {
  promise: Promise<ListenResult>;
  stop: () => void;
} {
  const recognition = createRecognition();
  if (!recognition) {
    return {
      promise: Promise.resolve({
        ok: false,
        error: "Speech recognition is not supported in this browser.",
      }),
      stop: () => undefined,
    };
  }

  let stopped = false;
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.continuous = false;

  const promise = new Promise<ListenResult>((resolve) => {
    recognition.onresult = (ev) => {
      const text = ev.results[0]?.[0]?.transcript ?? "";
      resolve({ ok: true, text });
    };
    recognition.onerror = (ev) => {
      resolve({ ok: false, error: ev.error || "recognition_error" });
    };
    recognition.onend = () => {
      if (!stopped) {
        resolve({ ok: false, error: "no_speech" });
      }
    };
    try {
      recognition.start();
    } catch (err) {
      resolve({
        ok: false,
        error: err instanceof Error ? err.message : "start_failed",
      });
    }
  });

  return {
    promise,
    stop: () => {
      stopped = true;
      try {
        recognition.abort();
      } catch {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      }
    },
  };
}

export function speakText(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
): { cancel: () => void } {
  if (!speechSynthesisSupported()) {
    onEnd?.();
    return { cancel: () => undefined };
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.onstart = () => onStart?.();
  utter.onend = () => onEnd?.();
  utter.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utter);
  return {
    cancel: () => {
      window.speechSynthesis.cancel();
      onEnd?.();
    },
  };
}
