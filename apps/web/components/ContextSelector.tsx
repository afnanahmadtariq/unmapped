"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCountry, listCountriesByRegion } from "@/lib/config";
import { SUPPORTED_LOCALES } from "@/lib/i18n";

interface Props {
  country: string;
  locale: string;
  labels: { country: string; language: string };
}

const SUPPORTED_LOCALE_CODES = new Set(SUPPORTED_LOCALES.map((l) => l.code));

/** Pick a UI locale for a country: its registry default if we support it,
 *  otherwise English. */
function localeForCountry(countryCode: string): string {
  const cfg = getCountry(countryCode);
  return SUPPORTED_LOCALE_CODES.has(cfg.defaultLocale) ? cfg.defaultLocale : "en";
}

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

  const setCountry = (nextCountry: string) => {
    // Switching country re-aligns the UI language to that country's default
    // locale, falling back to English when we don't ship a translation.
    const next = new URLSearchParams(params.toString());
    next.set("country", nextCountry);
    next.set("locale", localeForCountry(nextCountry));
    router.replace(`?${next.toString()}`);
  };

  const setLocale = (nextLocale: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("locale", nextLocale);
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
          onChange={(e) => setCountry(e.target.value)}
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
          onChange={(e) => setLocale(e.target.value)}
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
