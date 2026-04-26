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
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100%-2rem))] flex-col gap-2 md:bottom-6 md:right-6">
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
      <CheckCircle2 className="h-4 w-4 text-positive" />
    ) : item.tone === "error" ? (
      <AlertCircle className="h-4 w-4 text-danger" />
    ) : (
      <Info className="h-4 w-4 text-accent" />
    );

  const tint =
    item.tone === "success"
      ? "border-positive/30 bg-positive/10"
      : item.tone === "error"
        ? "border-danger/30 bg-danger/10"
        : "border-accent/30 bg-accent/10";

  return (
    <div
      className={clsx(
        "pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 backdrop-blur-md transition-all duration-200",
        tint,
        mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      )}
    >
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg-primary">{item.title}</p>
        {item.body && (
          <p className="mt-0.5 text-xs text-fg-secondary">{item.body}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
