import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { parse as csvParse } from 'csv-parse/sync';
import { HarvestedDataset } from '../types/dataset.types';
import { StorageService } from '../storage/storage.service';

export abstract class BaseHarvester {
  protected readonly logger: Logger;
  protected readonly http: AxiosInstance;

  constructor(protected readonly storage: StorageService) {
    this.logger = new Logger(this.constructor.name);
    this.http = axios.create({ timeout: 30000, headers: { 'Accept': '*/*', 'User-Agent': 'DataHarvester/1.0' } });
  }

  abstract get sourceId(): string;
  abstract get cronExpression(): string;
  abstract harvest(): Promise<void>;

  protected nextRun(cron: string): string {
    // Approximate next run based on cron — add 7 days for weekly, 1 day for daily etc.
    const parts = cron.split(' ');
    const now = new Date();
    if (parts[4] !== '*') now.setDate(now.getDate() + 7);   // weekly
    else if (parts[2] !== '*') now.setDate(now.getDate() + 30); // monthly
    else now.setDate(now.getDate() + 1);                         // daily
    return now.toISOString();
  }

  /** Parse a World Bank JSON response [meta, records] → normalized records */
  protected parseWorldBank(raw: any[]): { meta: any; records: Record<string, any>[] } {
    const [meta, data] = Array.isArray(raw) ? raw : [raw, []];
    const records = (data || [])
      .filter((r: any) => r.value !== null && r.value !== undefined)
      .map((r: any) => ({
        country: r.country?.value,
        countryCode: r.countryiso3code,
        year: parseInt(r.date, 10),
        value: typeof r.value === 'number' ? parseFloat(r.value.toFixed(4)) : r.value,
        unit: r.unit || '',
        indicatorId: r.indicator?.id,
        indicatorName: r.indicator?.value,
      }));
    return { meta, records };
  }

  /** Fetch paginated World Bank data (all pages) */
  protected async fetchAllWorldBankPages(baseUrl: string): Promise<Record<string, any>[]> {
    let page = 1;
    let totalPages = 1;
    const all: Record<string, any>[] = [];

    do {
      const url = `${baseUrl}&page=${page}`;
      const { data } = await this.http.get(url);
      const [meta, records] = Array.isArray(data) ? data : [data, []];
      if (page === 1) totalPages = meta?.pages || 1;
      const filtered = (records || []).filter((r: any) => r.value !== null && r.value !== undefined);
      all.push(...filtered);
      page++;
    } while (page <= totalPages && page <= 20); // cap at 20 pages

    return all;
  }

  /** Parse CSV text into array of objects */
  protected parseCsv(text: string): Record<string, any>[] {
    try {
      return csvParse(text, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, any>[];
    } catch {
      // fallback manual parse
      const lines = text.trim().split('\n').filter(l => l.trim());
      if (lines.length < 2) return [];
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      return lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.replace(/"/g, '').trim());
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
      });
    }
  }

  protected makeDataset(
    partial: Omit<HarvestedDataset, 'lastFetched' | 'nextScheduled' | 'cronExpression' | 'fields' | 'recordCount'>
      & { records: Record<string, any>[] }
  ): HarvestedDataset {
    return {
      ...partial,
      cronExpression: this.cronExpression,
      lastFetched: new Date().toISOString(),
      nextScheduled: this.nextRun(this.cronExpression),
      recordCount: partial.records.length,
      fields: partial.records.length > 0 ? Object.keys(partial.records[0]) : [],
    };
  }
}
