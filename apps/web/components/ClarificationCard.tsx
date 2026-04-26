"use client";

import { useState } from "react";
import clsx from "clsx";
import { ArrowRight, HelpCircle, Loader2, MessageCircleQuestion } from "lucide-react";
import type { ClarifyingQuestion } from "@/lib/apiClient";
import type { Dictionary } from "@/lib/i18n";

interface Props {
  reason: string;
  questions: ClarifyingQuestion[];
  loading?: boolean;
  t: Dictionary;
  onSubmit: (answers: Record<string, string>) => void;
}

export default function ClarificationCard({ reason, questions, loading, t, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [other, setOther] = useState<Record<string, string>>({});

  const setAnswer = (qid: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const allAnswered = questions.every((q) => {
    const a = answers[q.id];
    if (!a) return false;
    if (a === "__other__") return (other[q.id] ?? "").trim().length > 0;
    return true;
  });

  const submit = () => {
    if (!allAnswered) return;
    const final: Record<string, string> = {};
    for (const q of questions) {
      const a = answers[q.id];
      final[q.id] = a === "__other__" ? other[q.id].trim() : a;
    }
    onSubmit(final);
  };

  return (
    <section className="rounded-2xl border border-accent/30 bg-accent/5 p-6 shadow-sm animate-[slideUp_220ms_ease-out]">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-white">
          <MessageCircleQuestion className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-fg-primary">
            {t.profile.clarifyTitle}
          </h3>
          <p className="mt-1 text-xs text-fg-secondary">{t.profile.clarifyHint}</p>
          <p className="mt-2 inline-flex items-start gap-1.5 rounded-md bg-bg-base px-2 py-1 text-[11px] text-fg-muted">
            <HelpCircle className="mt-px h-3 w-3 shrink-0 text-accent" />
            {reason}
          </p>
        </div>
      </header>

      <div className="mt-6 space-y-5">
        {questions.map((q, qi) => (
          <fieldset key={q.id} className="space-y-2">
            <legend className="text-sm font-medium text-fg-primary">
              {qi + 1}. {q.prompt}
            </legend>
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAnswer(q.id, opt.value)}
                    className={clsx(
                      "rounded-lg border px-3 py-2 text-left text-sm transition",
                      selected
                        ? "border-accent bg-accent text-white"
                        : "border-border-default bg-bg-raised text-fg-secondary hover:border-accent/50 hover:bg-bg-hover"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
              {q.allowOther !== false && (
                <button
                  type="button"
                  onClick={() => setAnswer(q.id, "__other__")}
                  className={clsx(
                    "rounded-lg border px-3 py-2 text-left text-sm transition",
                    answers[q.id] === "__other__"
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-dashed border-border-strong bg-bg-raised text-fg-muted hover:border-accent/50 hover:text-fg-primary"
                  )}
                >
                  Other...
                </button>
              )}
            </div>
            {answers[q.id] === "__other__" && (
              <input
                value={other[q.id] ?? ""}
                onChange={(e) => setOther((p) => ({ ...p, [q.id]: e.target.value }))}
                placeholder={t.profile.clarifyOtherPlaceholder}
                className="mt-2 w-full rounded-md border border-border-default bg-bg-base px-3 py-2 text-sm text-fg-primary focus:border-accent/60 focus:outline-hidden focus:ring-2 focus:ring-accent/20"
              />
            )}
          </fieldset>
        ))}
      </div>

      <footer className="mt-6 flex items-center justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={!allAnswered || loading}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Mapping...
            </>
          ) : (
            <>
              {t.profile.clarifySubmit} <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </footer>
    </section>
  );
}
