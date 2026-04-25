// UNMAPPED - live ESCO REST client.
// Public docs: https://esco.ec.europa.eu/en/use-esco/download
// Endpoint: https://ec.europa.eu/esco/api/search?type=skill&text=...&language=en
// Falls back to the bundled snapshot in /public/data/esco-skills.json if live fails or times out.

import escoSnapshot from "@/public/data/esco-skills.json";

const ESCO_BASE = "https://ec.europa.eu/esco/api";
const TIMEOUT_MS = 4000;

export interface EscoLiveSkill {
  uri: string;
  preferredLabel: string;
  alternativeLabels: string[];
  description?: string;
  sourceLive: true;
}

export interface EscoSnapshotSkill {
  code: string;
  label: string;
  category: string;
  iscoLinks: string[];
  sourceLive: false;
}

export type EscoSkill = EscoLiveSkill | EscoSnapshotSkill;

// Tiny in-memory cache, keyed by query. Cleared on cold start.
const cache = new Map<string, { ts: number; value: unknown }>();
const TTL_MS = 30 * 60 * 1000;

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
    });
  } finally {
    clearTimeout(t);
  }
}

/** Search ESCO skills by free text. Live-first, snapshot fallback. */
export async function searchSkills(
  text: string,
  limit = 8
): Promise<{ results: EscoSkill[]; live: boolean }> {
  const cacheKey = `search:${text.toLowerCase()}:${limit}`;
  const cached = cacheGet<{ results: EscoSkill[]; live: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${ESCO_BASE}/search?type=skill&text=${encodeURIComponent(text)}&language=en&limit=${limit}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`ESCO ${res.status}`);
    const json = (await res.json()) as {
      _embedded?: {
        results?: Array<{
          uri: string;
          title: string;
          preferredLabel?: { en?: string };
          alternativeLabel?: { en?: string[] };
          description?: { en?: { literal?: string } };
        }>;
      };
    };
    const items = json._embedded?.results ?? [];
    const results: EscoLiveSkill[] = items.map((s) => ({
      uri: s.uri,
      preferredLabel: s.preferredLabel?.en ?? s.title,
      alternativeLabels: s.alternativeLabel?.en ?? [],
      description: s.description?.en?.literal,
      sourceLive: true,
    }));
    const out = { results: results as EscoSkill[], live: true };
    cacheSet(cacheKey, out);
    return out;
  } catch {
    // Snapshot fallback: linear search over labels.
    const lower = text.toLowerCase();
    const matches = escoSnapshot.skills
      .filter((s) => s.label.toLowerCase().includes(lower))
      .slice(0, limit)
      .map((s) => ({ ...s, sourceLive: false as const }));
    return { results: matches as EscoSkill[], live: false };
  }
}

/** Look up an ESCO skill by URI. Returns description + broader/narrower if live. */
export async function getSkillByUri(
  uri: string
): Promise<{ skill: EscoLiveSkill | null; live: boolean }> {
  const cacheKey = `uri:${uri}`;
  const cached = cacheGet<{ skill: EscoLiveSkill | null; live: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${ESCO_BASE}/resource/skill?uri=${encodeURIComponent(uri)}&language=en`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`ESCO ${res.status}`);
    const json = (await res.json()) as {
      uri: string;
      preferredLabel?: { en?: string };
      alternativeLabel?: { en?: string[] };
      description?: { en?: { literal?: string } };
    };
    const skill: EscoLiveSkill = {
      uri: json.uri,
      preferredLabel: json.preferredLabel?.en ?? "",
      alternativeLabels: json.alternativeLabel?.en ?? [],
      description: json.description?.en?.literal,
      sourceLive: true,
    };
    const out = { skill, live: true };
    cacheSet(cacheKey, out);
    return out;
  } catch {
    return { skill: null, live: false };
  }
}

/** Quick health check used by the dashboard to label data sources. */
export async function probeEsco(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${ESCO_BASE}/search?type=skill&text=python&language=en&limit=1`,
      2500
    );
    return res.ok;
  } catch {
    return false;
  }
}
