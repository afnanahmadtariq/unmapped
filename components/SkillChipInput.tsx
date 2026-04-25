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
  placeholder = "Type a skill and press Enter...",
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
        className="group flex flex-wrap items-center gap-2 rounded-md border border-border-default bg-bg-base px-3 py-2 transition focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20"
        aria-label={ariaLabel}
      >
        {value.map((s, i) => (
          <span
            key={`${s}-${i}`}
            className="inline-flex animate-[fadeIn_120ms_ease-out] items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs text-accent"
          >
            {s}
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded-full p-0.5 text-accent/70 hover:bg-accent/20 hover:text-accent"
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
          className="flex-1 min-w-35 bg-transparent text-sm text-fg-primary outline-hidden placeholder:text-fg-muted"
        />
        {draft.trim() && (
          <button
            type="button"
            onClick={() => add(draft)}
            className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-xs text-accent hover:bg-accent/20"
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
              className="rounded-full border border-border-default bg-bg-raised px-2 py-0.5 text-[11px] text-fg-secondary transition hover:border-accent/40 hover:text-accent"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
