"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { listCountries } from "@/lib/config";
import { SUPPORTED_LOCALES } from "@/lib/i18n";

interface Props {
  country: string;
  locale: string;
  labels: { country: string; language: string };
}

export default function ContextSelector({ country, locale, labels }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const update = (key: "country" | "locale", value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.replace(`?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <label className="flex items-center gap-1.5">
        <span className="text-fg-muted">{labels.country}</span>
        <select
          aria-label={labels.country}
          value={country}
          onChange={(e) => update("country", e.target.value)}
          className="rounded-md border border-border-default bg-bg-raised px-2 py-1 text-fg-primary"
        >
          {listCountries().map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-fg-muted">{labels.language}</span>
        <select
          aria-label={labels.language}
          value={locale}
          onChange={(e) => update("locale", e.target.value)}
          className="rounded-md border border-border-default bg-bg-raised px-2 py-1 text-fg-primary"
        >
          {SUPPORTED_LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
