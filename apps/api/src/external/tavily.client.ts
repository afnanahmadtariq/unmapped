import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { EnvService } from '../infra/config/env.service';

export interface TavilyHit {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Tavily live web search. Ported from apps/web/lib/tavily.ts.
 * Fails soft: returns [] if the key is missing or the upstream errors.
 */
@Injectable()
export class TavilyClient {
  private readonly http: AxiosInstance;
  private readonly apiKey?: string;

  constructor(env: EnvService) {
    this.apiKey = env.get('TAVILY_API_KEY');
    this.http = axios.create({
      baseURL: 'https://api.tavily.com',
      timeout: 8000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async search(query: string, max = 4): Promise<TavilyHit[]> {
    if (!this.apiKey) return [];
    try {
      const { data } = await this.http.post<{
        results?: Array<{ title: string; url: string; content?: string }>;
      }>('/search', {
        api_key: this.apiKey,
        query,
        max_results: max,
        search_depth: 'basic',
      });
      return (data.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: (r.content ?? '').slice(0, 180),
      }));
    } catch {
      return [];
    }
  }
}
