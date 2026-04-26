import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

/**
 * World Bank WDI client. Ported from apps/web/lib/worldBankApi.ts.
 * Indicator codes are stable WDI series IDs.
 */

export const WB_INDICATORS = {
  YOUTH_UNEMPLOYMENT: 'SL.UEM.1524.NE.ZS',
  GDP_PCAP: 'NY.GDP.PCAP.CD',
  ADULT_LITERACY: 'SE.ADT.LITR.ZS',
  LABOR_FORCE_FEMALE: 'SL.TLF.CACT.FE.ZS',
  INTERNET_USERS: 'IT.NET.USER.ZS',
} as const;

export type WbIndicatorKey = keyof typeof WB_INDICATORS;

export interface WbIndicatorPoint {
  indicator: WbIndicatorKey;
  iso3: string;
  year: number;
  value: number;
}

const WB_BASE = 'https://api.worldbank.org/v2';
const TIMEOUT_MS = 4000;
const TTL_MS = 60 * 60 * 1000;

@Injectable()
export class WorldBankApiClient {
  private readonly logger = new Logger(WorldBankApiClient.name);
  private readonly http: AxiosInstance;
  private readonly cache = new Map<string, { ts: number; value: unknown }>();

  constructor() {
    this.http = axios.create({
      baseURL: WB_BASE,
      timeout: TIMEOUT_MS,
      headers: { Accept: 'application/json' },
    });
  }

  async fetchIndicator(
    iso3: string,
    indicator: WbIndicatorKey,
  ): Promise<WbIndicatorPoint | null> {
    const code = WB_INDICATORS[indicator];
    const cacheKey = `wb:${iso3}:${code}`;
    const cached = this.cacheGet<WbIndicatorPoint>(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await this.http.get(
        `/country/${iso3}/indicator/${code}`,
        { params: { format: 'json', per_page: 20, date: '2018:2024' } },
      );
      const series: Array<{ value: number | null; date: string }> =
        Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
      const latest = series.find((p) => p.value !== null);
      if (!latest) return null;
      const point: WbIndicatorPoint = {
        indicator,
        iso3,
        year: Number(latest.date),
        value: Number(latest.value),
      };
      this.cacheSet(cacheKey, point);
      return point;
    } catch (err: any) {
      this.logger.warn(`WB ${iso3}/${code} failed: ${err.message}`);
      return null;
    }
  }

  async fetchIndicators(
    iso3: string,
    keys: WbIndicatorKey[],
  ): Promise<Record<WbIndicatorKey, WbIndicatorPoint | null>> {
    const entries = await Promise.all(
      keys.map(async (k) => [k, await this.fetchIndicator(iso3, k)] as const),
    );
    return Object.fromEntries(entries) as Record<
      WbIndicatorKey,
      WbIndicatorPoint | null
    >;
  }

  async probe(): Promise<boolean> {
    try {
      const res = await this.http.get('/country/GHA/indicator/NY.GDP.PCAP.CD', {
        params: { format: 'json', per_page: 1 },
        timeout: 2500,
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
