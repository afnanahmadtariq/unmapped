"use client";

import { useState, KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  ariaLabel?: string;
}

export default function SkillChipInput({
  value,
  onChange,
  placeholder = "Type a skill and press Enter…",
  suggestions = [],
  ariaLabel,
}: Props) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (value.some((s) => s.toLowerCase() === v.toLowerCase())) return;
    onChange([...value, v]);
    setDraft("");
  };

  const remove = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      remove(value.length - 1);
    }
  };

  const filteredSuggestions = suggestions
    .filter(
      (s) =>
        s.toLowerCase().includes(draft.toLowerCase()) &&
        !value.some((v) => v.toLowerCase() === s.toLowerCase())
    )
    .slice(0, 5);

  return (
    <div className="space-y-2">
      <div
        className="group flex flex-wrap items-center gap-2 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 transition focus-within:border-sky-500/60 focus-within:ring-2 focus-within:ring-sky-500/20"
        aria-label={ariaLabel}
      >
        {value.map((s, i) => (
          <span
            key={`${s}-${i}`}
            className="inline-flex animate-[fadeIn_120ms_ease-out] items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-200"
          >
            {s}
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded-full p-0.5 text-sky-300/70 hover:bg-sky-500/20 hover:text-sky-100"
              aria-label={`Remove ${s}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[140px] bg-transparent text-sm text-neutral-100 outline-hidden placeholder:text-neutral-500"
        />
        {draft.trim() && (
          <button
            type="button"
            onClick={() => add(draft)}
            className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300 hover:bg-sky-500/20"
            aria-label="Add"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>
      {filteredSuggestions.length > 0 && draft.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-neutral-800 bg-neutral-900/60 px-2 py-0.5 text-[11px] text-neutral-400 transition hover:border-sky-500/40 hover:text-sky-300"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
