// Cartographer - thin typed wrapper around the Web Speech API for voice input.
// Free, browser-native, no API key. Works in Chrome / Edge / Safari (with
// vendor prefix). Firefox does not support it - we degrade gracefully.

// Minimal type stubs so we don't need a global @types extension.
type SRConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SREventLike) => void) | null;
  onerror: ((ev: SRErrorLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SREventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence?: number };
  }>;
}

interface SRErrorLike {
  error: string;
  message?: string;
}

export function getSpeechRecognitionCtor(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

// Map our app locale (BCP-47 short form) to a more specific recognition tag
// because the Web Speech API expects region-qualified codes (en-US, fr-FR, ...).
const LOCALE_TO_BCP47: Record<string, string> = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-MX",
  pt: "pt-BR",
  de: "de-DE",
  ru: "ru-RU",
  tr: "tr-TR",
  id: "id-ID",
  vi: "vi-VN",
  zh: "zh-CN",
  hi: "hi-IN",
  bn: "bn-BD",
  sw: "sw-KE",
  ar: "ar-SA",
  ur: "ur-PK",
};

export function speechLangFor(locale: string): string {
  return LOCALE_TO_BCP47[locale] ?? "en-US";
}

export type RecognitionEventCallbacks = {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (kind: string, message?: string) => void;
  onEnd: () => void;
};

export interface RecognitionHandle {
  stop: () => void;
  abort: () => void;
}

/** Start speech recognition. Returns a handle to stop/abort. The caller is
 *  responsible for permission UX (browser will prompt on first start()). */
export function startRecognition(
  locale: string,
  cb: RecognitionEventCallbacks
): RecognitionHandle | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = speechLangFor(locale);
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onresult = (ev) => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      const t = r[0]?.transcript ?? "";
      if (r.isFinal) {
        cb.onFinal(t);
      } else {
        interim += t;
      }
    }
    if (interim) cb.onInterim(interim);
  };
  rec.onerror = (ev) => {
    cb.onError(ev.error ?? "unknown", ev.message);
  };
  rec.onend = () => cb.onEnd();

  try {
    rec.start();
  } catch (e) {
    cb.onError("start-failed", e instanceof Error ? e.message : String(e));
    return null;
  }

  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    },
    abort: () => {
      try {
        rec.abort();
      } catch {
        /* already aborted */
      }
    },
  };
}
