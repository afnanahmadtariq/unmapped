"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Mic, MicOff, Square } from "lucide-react";
import {
  isSpeechRecognitionSupported,
  startRecognition,
  type RecognitionHandle,
} from "@/lib/speech";
import type { Dictionary } from "@/lib/i18n";

interface Props {
  locale: string;
  /** Current text in the field, so we can append rather than overwrite. */
  value: string;
  /** Called with the merged final text (existing value + appended speech). */
  onAppend: (next: string) => void;
  /** Called as the user is mid-utterance, useful for greying interim text. */
  onInterim?: (interim: string) => void;
  t: Dictionary;
}

type Status = "idle" | "starting" | "listening" | "error" | "unsupported";

export default function VoiceInputButton({
  locale,
  value,
  onAppend,
  onInterim,
  t,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const handleRef = useRef<RecognitionHandle | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!isSpeechRecognitionSupported()) setStatus("unsupported");
    return () => {
      handleRef.current?.abort();
      handleRef.current = null;
    };
  }, []);

  const start = () => {
    if (status === "listening" || status === "starting") return;
    setErrorMsg(null);
    setStatus("starting");
    const h = startRecognition(locale, {
      onInterim: (interim) => {
        setStatus("listening");
        onInterim?.(interim);
      },
      onFinal: (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const sep = valueRef.current && !/\s$/.test(valueRef.current) ? " " : "";
        onAppend(valueRef.current + sep + trimmed);
        onInterim?.("");
      },
      onError: (kind, message) => {
        setStatus("error");
        const friendly =
          kind === "not-allowed" || kind === "service-not-allowed"
            ? t.profile.voiceErrorPermission
            : kind === "no-speech"
              ? t.profile.voiceErrorNoSpeech
              : kind === "network"
                ? t.profile.voiceErrorNetwork
                : message ?? t.profile.voiceErrorGeneric;
        setErrorMsg(friendly);
      },
      onEnd: () => {
        handleRef.current = null;
        setStatus((s) => (s === "error" ? s : "idle"));
        onInterim?.("");
      },
    });
    if (h) handleRef.current = h;
    else {
      setStatus("unsupported");
      handleRef.current = null;
    }
  };

  const stop = () => {
    handleRef.current?.stop();
  };

  if (status === "unsupported") {
    return (
      <span
        title={t.profile.voiceUnsupported}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-border-default bg-bg-base px-2.5 py-1 text-[11px] text-fg-muted"
      >
        <MicOff className="h-3 w-3" /> {t.profile.voiceUnsupportedShort}
      </span>
    );
  }

  const listening = status === "listening" || status === "starting";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-label={listening ? t.profile.voiceStop : t.profile.voiceStart}
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition",
          listening
            ? "border-danger bg-danger/10 text-danger"
            : "border-border-default bg-bg-base text-fg-secondary hover:border-accent/40 hover:text-accent"
        )}
      >
        {listening ? (
          <>
            <Square className="h-3 w-3 animate-pulse" /> {t.profile.voiceListening}
          </>
        ) : (
          <>
            <Mic className="h-3 w-3" /> {t.profile.voiceStart}
          </>
        )}
      </button>
      {status === "error" && errorMsg && (
        <span className="text-[10px] text-danger">{errorMsg}</span>
      )}
    </div>
  );
}
