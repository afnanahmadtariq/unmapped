"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { listCountriesByRegion } from "@/lib/config";
import { SUPPORTED_LOCALES } from "@/lib/i18n";

interface Props {
  country: string;
  locale: string;
  labels: { country: string; language: string };
}

const SUPPORTED_LOCALE_CODES = new Set(SUPPORTED_LOCALES.map((l) => l.code));

export default function ContextSelector({ country, locale, labels }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  // First-load: if URL has no `locale` param, try the browser's preferred
  // language. Only override if it's one we actually support.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (params.get("locale")) return;
    const nav = (navigator.languages?.[0] ?? navigator.language ?? "en")
      .toLowerCase()
      .split("-")[0];
    if (nav && nav !== locale && SUPPORTED_LOCALE_CODES.has(nav)) {
      const next = new URLSearchParams(params.toString());
      next.set("locale", nav);
      router.replace(`?${next.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (key: "country" | "locale", value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.replace(`?${next.toString()}`);
  };

  const grouped = listCountriesByRegion();

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <label className="flex items-center gap-1.5">
        <span className="sr-only md:not-sr-only text-fg-muted">{labels.country}</span>
        <select
          aria-label={labels.country}
          value={country}
          onChange={(e) => update("country", e.target.value)}
          className="max-w-45 rounded-md border border-border-default bg-bg-raised px-2 py-1 text-fg-primary"
        >
          {grouped.map((g) => (
            <optgroup key={g.region} label={g.region}>
              {g.countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <span className="sr-only md:not-sr-only text-fg-muted">{labels.language}</span>
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
