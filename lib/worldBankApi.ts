// UNMAPPED - live World Bank WDI client.
// Public docs: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-api-overview
// Endpoint: https://api.worldbank.org/v2/country/{ISO3}/indicator/{code}?format=json&per_page=10
// Falls back to bundled snapshot values if live fails or times out.

import type { CountryCode } from "@/types";
import { getCountryData } from "@/lib/data";

const WB_BASE = "https://api.worldbank.org/v2";
const TIMEOUT_MS = 4000;

const ISO3: Record<CountryCode, string> = {
  GH: "GHA",
  BD: "BGD",
};

/** Indicators we care about. Codes are stable WDI series IDs. */
export const INDICATORS = {
  YOUTH_UNEMPLOYMENT: "SL.UEM.1524.NE.ZS", // Youth unemployment, total (% of labor force ages 15-24)
  GDP_PCAP: "NY.GDP.PCAP.CD",              // GDP per capita (current US$)
  ADULT_LITERACY: "SE.ADT.LITR.ZS",        // Literacy rate, adult total
  LABOR_FORCE_FEMALE: "SL.TLF.CACT.FE.ZS", // Labor force participation, female (% female 15+)
  INTERNET_USERS: "IT.NET.USER.ZS",        // Individuals using the Internet (%)
} as const;

export type IndicatorKey = keyof typeof INDICATORS;

export interface IndicatorPoint {
  indicator: IndicatorKey;
  iso3: string;
  year: number;
  value: number;
  source: "live-worldbank" | "snapshot";
}

const cache = new Map<string, { ts: number; value: unknown }>();
const TTL_MS = 60 * 60 * 1000;

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.ts > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}
function cacheSet<T>(key: string, value: T) {
  cache.set(key, { ts: Date.now(), value });
}

async function fetchWithTimeout(url: string, ms = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } finally {
    clearTimeout(t);
  }
}

export async function fetchIndicator(
  countryCode: CountryCode,
  indicator: IndicatorKey
): Promise<IndicatorPoint | null> {
  const code = INDICATORS[indicator];
  const iso3 = ISO3[countryCode];
  const cacheKey = `wb:${iso3}:${code}`;
  const cached = cacheGet<IndicatorPoint>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${WB_BASE}/country/${iso3}/indicator/${code}?format=json&per_page=20&date=2018:2024`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`WB ${res.status}`);
    const json = (await res.json()) as [unknown, Array<{ value: number | null; date: string }>];
    const series = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
    const latest = series.find((p) => p.value !== null);
    if (!latest) throw new Error("WB no value");
    const point: IndicatorPoint = {
      indicator,
      iso3,
      year: Number(latest.date),
      value: Number(latest.value),
      source: "live-worldbank",
    };
    cacheSet(cacheKey, point);
    return point;
  } catch {
    // Snapshot fallback for indicators we have locally
    const snap = snapshotFallback(countryCode, indicator);
    if (snap) cacheSet(cacheKey, snap);
    return snap;
  }
}

function snapshotFallback(
  countryCode: CountryCode,
  indicator: IndicatorKey
): IndicatorPoint | null {
  const data = getCountryData(countryCode);
  const iso3 = ISO3[countryCode];
  if (indicator === "YOUTH_UNEMPLOYMENT") {
    return {
      indicator,
      iso3,
      year: 2023,
      value: data.growth.youthUnemploymentRate,
      source: "snapshot",
    };
  }
  return null;
}

/** Bulk fetch multiple indicators in parallel. */
export async function fetchIndicators(
  countryCode: CountryCode,
  keys: IndicatorKey[]
): Promise<Record<IndicatorKey, IndicatorPoint | null>> {
  const entries = await Promise.all(
    keys.map(async (k) => [k, await fetchIndicator(countryCode, k)] as const)
  );
  return Object.fromEntries(entries) as Record<IndicatorKey, IndicatorPoint | null>;
}

/** Health check used by the dashboard to label freshness. */
export async function probeWorldBank(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${WB_BASE}/country/GHA/indicator/${INDICATORS.GDP_PCAP}?format=json&per_page=1`,
      2500
    );
    return res.ok;
  } catch {
    return false;
  }
}
