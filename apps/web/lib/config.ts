// Cartographer - country registry, sourced from lib/data/countries.json.
// Adding a new country = adding one entry to that file. No code changes here.
// The same file lives in apps/api/src/country/data/countries.json — keep in sync.

import countriesData from "@/lib/data/countries.json";
import type { CountryConfig, CountryCode } from "@/types";

interface RawCountry {
  code: string;
  iso3: string;
  name: string;
  region: string;
  currency: string;
  currencySymbol: string;
  defaultLocale: string;
  automationCalibration: number;
  context: "urban-informal" | "mixed-urban-rural" | "rural-agricultural";
  snapshot?: boolean;
}

const RAW: RawCountry[] = countriesData.countries as RawCountry[];

const REGISTRY: Map<string, CountryConfig> = new Map(
  RAW.map((c) => [
    c.code.toUpperCase(),
    {
      code: c.code.toUpperCase(),
      iso3: c.iso3,
      name: c.name,
      region: c.region,
      defaultLocale: c.defaultLocale,
      currency: c.currency,
      currencySymbol: c.currencySymbol,
      automationCalibration: c.automationCalibration,
      context: c.context,
      hasSnapshot: !!c.snapshot,
    },
  ])
);

export const DEFAULT_COUNTRY: CountryCode = "GH";

export function getCountry(code: string | undefined | null): CountryConfig {
  if (!code) return REGISTRY.get(DEFAULT_COUNTRY)!;
  const hit = REGISTRY.get(code.toUpperCase());
  if (hit) return hit;
  return REGISTRY.get(DEFAULT_COUNTRY)!;
}

export function isSupportedCountry(code: string | undefined | null): boolean {
  return !!code && REGISTRY.has(code.toUpperCase());
}

export function listCountries(): CountryConfig[] {
  return Array.from(REGISTRY.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function listCountriesByRegion(): Array<{ region: string; countries: CountryConfig[] }> {
  const byRegion = new Map<string, CountryConfig[]>();
  for (const c of listCountries()) {
    const arr = byRegion.get(c.region) ?? [];
    arr.push(c);
    byRegion.set(c.region, arr);
  }
  return Array.from(byRegion.entries())
    .map(([region, countries]) => ({ region, countries }))
    .sort((a, b) => a.region.localeCompare(b.region));
}

// Back-compat alias used by some older imports.
export const COUNTRY_REGISTRY: Record<string, CountryConfig> = Object.fromEntries(REGISTRY);
