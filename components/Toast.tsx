"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import clsx from "clsx";

type Tone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  body?: string;
}

interface ToastApi {
  push: (t: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push: ToastApi["push"] = useCallback((t) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-[min(360px,calc(100%-3rem))] flex-col gap-2">
        {items.map((it) => (
          <ToastView key={it.id} item={it} onClose={() => setItems((p) => p.filter((x) => x.id !== it.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe fallback so callers in non-provider trees do not crash.
    return { push: () => undefined };
  }
  return ctx;
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  const icon =
    item.tone === "success" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
    ) : item.tone === "error" ? (
      <AlertCircle className="h-4 w-4 text-rose-300" />
    ) : (
      <Info className="h-4 w-4 text-sky-300" />
    );

  const tint =
    item.tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10"
      : item.tone === "error"
        ? "border-rose-500/30 bg-rose-500/10"
        : "border-sky-500/30 bg-sky-500/10";

  return (
    <div
      className={clsx(
        "pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 backdrop-blur transition-all duration-200",
        tint,
        mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      )}
    >
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-100">{item.title}</p>
        {item.body && (
          <p className="mt-0.5 text-xs text-neutral-300">{item.body}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="rounded p-1 text-neutral-400 hover:bg-neutral-900/40 hover:text-neutral-100"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
