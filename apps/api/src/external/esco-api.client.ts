import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

/**
 * Live ESCO REST client (https://esco.ec.europa.eu/en/use-esco/esco-web-services).
 * Ported from apps/web/lib/escoApi.ts. Uses an in-memory TTL cache to keep
 * search calls cheap. Falls back are now the responsibility of the caller —
 * the API has a Postgres mirror to query against.
 */

export interface EscoLiveSkill {
  uri: string;
  preferredLabel: string;
  alternativeLabels: string[];
  description?: string;
}

const ESCO_BASE = 'https://ec.europa.eu/esco/api';
const TIMEOUT_MS = 4000;
const TTL_MS = 30 * 60 * 1000;

@Injectable()
export class EscoApiClient {
  private readonly logger = new Logger(EscoApiClient.name);
  private readonly http: AxiosInstance;
  private readonly cache = new Map<string, { ts: number; value: unknown }>();

  constructor() {
    this.http = axios.create({
      baseURL: ESCO_BASE,
      timeout: TIMEOUT_MS,
      headers: { Accept: 'application/json' },
    });
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

  async searchSkills(text: string, limit = 8): Promise<EscoLiveSkill[]> {
    const key = `search:${text.toLowerCase()}:${limit}`;
    const cached = this.cacheGet<EscoLiveSkill[]>(key);
    if (cached) return cached;
    try {
      const { data } = await this.http.get<{
        _embedded?: {
          results?: Array<{
            uri: string;
            title: string;
            preferredLabel?: { en?: string };
            alternativeLabel?: { en?: string[] };
            description?: { en?: { literal?: string } };
          }>;
        };
      }>('/search', {
        params: { type: 'skill', text, language: 'en', limit },
      });
      const items = data._embedded?.results ?? [];
      const results: EscoLiveSkill[] = items.map((s) => ({
        uri: s.uri,
        preferredLabel: s.preferredLabel?.en ?? s.title,
        alternativeLabels: s.alternativeLabel?.en ?? [],
        description: s.description?.en?.literal,
      }));
      this.cacheSet(key, results);
      return results;
    } catch (err: any) {
      this.logger.warn(`ESCO search failed for '${text}': ${err.message}`);
      return [];
    }
  }

  async probe(): Promise<boolean> {
    try {
      const res = await this.http.get('/search', {
        params: { type: 'skill', text: 'python', language: 'en', limit: 1 },
        timeout: 2500,
      });
      return res.status >= 200 && res.status < 300;
    } catch {
      return false;
    }
  }
}
