import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

const DBNOMICS_BASE = 'https://api.db.nomics.world/v22';
const TIMEOUT_MS = 8000;
const TTL_MS = 60 * 60 * 1000;

export interface DbnomicsObservation {
  /** ISO date string for the observation period (yearly → "2024", monthly → "2024-01"). */
  period: string;
  year: number;
  value: number;
}

/**
 * Thin DBnomics client used as a last-resort fallback when a primary
 * statistics endpoint (ILOSTAT bulk, World Bank WDI, …) is unreachable.
 *
 * DBnomics mirrors most macro / labour series with a uniform query
 * surface: `/series/{provider}/{dataset}/{seriesCode}` returns a
 * `period_start_day` / `value` array. Callers compose the seriesCode
 * (e.g. `WB/WDI/NY.GDP.PCAP.CD-USA`) and let this client take care of
 * caching + safe error handling.
 *
 * See plan.md "Phase 6 — Polish: Add DBnomics client … use it as a
 * fallback in any harvester whose primary endpoint times out."
 */
@Injectable()
export class DbnomicsClient {
  private readonly logger = new Logger(DbnomicsClient.name);
  private readonly http: AxiosInstance;
  private readonly cache = new Map<string, { ts: number; value: unknown }>();

  constructor() {
    this.http = axios.create({
      baseURL: DBNOMICS_BASE,
      timeout: TIMEOUT_MS,
      headers: { Accept: 'application/json', 'User-Agent': 'UNMAPPED/1.0' },
    });
  }

  /**
   * Fetch a full series from DBnomics. Pass the provider/dataset/series
   * triple as a single slash-joined string, e.g. `'WB/WDI/NY.GDP.PCAP.CD-USA'`
   * or `'ILO/UNE_2EAP_SEX_AGE_RT/A.USA.UNE_TUNE_SEX_AGE_RT.SEX_T.AGE_AGGREGATE_TOTAL'`.
   */
  async fetchSeries(seriesCode: string): Promise<DbnomicsObservation[]> {
    const cacheKey = `dbnomics:${seriesCode}`;
    const cached = this.cacheGet<DbnomicsObservation[]>(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await this.http.get(`/series/${seriesCode}`, {
        params: { observations: '1' },
      });
      const docs = data?.series?.docs ?? [];
      if (!Array.isArray(docs) || docs.length === 0) return [];
      const doc = docs[0] as {
        period: string[];
        period_start_day?: string[];
        value: Array<number | null>;
      };
      const periods: string[] = doc.period ?? doc.period_start_day ?? [];
      const values = doc.value ?? [];
      const out: DbnomicsObservation[] = [];
      for (let i = 0; i < periods.length; i++) {
        const v = values[i];
        if (v === null || v === undefined || Number.isNaN(Number(v))) continue;
        const period = String(periods[i]);
        const year = Number(period.slice(0, 4));
        if (!Number.isFinite(year)) continue;
        out.push({ period, year, value: Number(v) });
      }
      this.cacheSet(cacheKey, out);
      return out;
    } catch (err) {
      this.logger.warn(
        `DBnomics fetch failed for ${seriesCode}: ${(err as Error).message}`,
      );
      return [];
    }
  }

  /** Convenience: latest non-null observation in a series. */
  async fetchLatest(seriesCode: string): Promise<DbnomicsObservation | null> {
    const series = await this.fetchSeries(seriesCode);
    if (series.length === 0) return null;
    return series.reduce((acc, cur) =>
      acc === null || cur.year > acc.year ? cur : acc,
    );
  }

  async probe(): Promise<boolean> {
    try {
      const res = await this.http.get('/providers', {
        params: { limit: 1 },
        timeout: 4000,
      });
      return res.status >= 200 && res.status < 300;
    } catch {
      return false;
    }
  }

  private cacheGet<T>(key: string): T | undefined {
    const hit = this.cache.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.ts > TTL_MS) {
      this.cache.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  private cacheSet<T>(key: string, value: T) {
    this.cache.set(key, { ts: Date.now(), value });
  }
}
