import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { parse as csvParse } from 'csv-parse/sync';
import { HarvestedDataset } from '../types/dataset.types';
import { StorageService } from '../storage/storage.service';
import type { DatasetLoader } from '../storage/loader.types';
import type { LineageService } from '../lineage/lineage.service';
import type { DatasetRunKind } from '../lineage/dataset-run.entity';
import type {
  DbnomicsClient,
  DbnomicsObservation,
} from '../external/dbnomics.client';

/**
 * BaseHarvester now writes through three channels:
 *   1. `lineage.openRun()` — opens a `dataset_runs` row (status=pending).
 *   2. `loader.load(dataset, { runId })` — authoritative persistence.
 *   3. `storage.archive(dataset, runId)` — diagnostic JSON archive.
 *
 * On exit it always calls `lineage.closeRun()` so a failure leaves an
 * auditable `failed` row instead of a phantom `pending`. HarvestService
 * sets `_runKind` to override the default 'cron' for manual triggers.
 */
export abstract class BaseHarvester {
  protected readonly logger: Logger;
  protected readonly http: AxiosInstance;
  protected lineage?: LineageService;
  protected dbnomics?: DbnomicsClient;
  protected runKindOverride: DatasetRunKind | null = null;

  constructor(
    protected readonly storage: StorageService,
    protected readonly loader: DatasetLoader,
  ) {
    this.logger = new Logger(this.constructor.name);
    this.http = axios.create({
      timeout: 30000,
      headers: { Accept: '*/*', 'User-Agent': 'DataHarvester/1.0' },
    });
  }

  abstract get sourceId(): string;
  abstract get cronExpression(): string;
  abstract harvest(): Promise<void>;

  /** Display name surfaced in admin UI; subclasses can override. */
  get sourceName(): string {
    return this.sourceId;
  }

  /** Public homepage / API base URL of the dataset; subclasses should override. */
  get sourceUrl(): string | null {
    return null;
  }

  /** Free-form category mirroring `HarvestedDataset.category`. */
  get sourceCategory(): string | null {
    return null;
  }

  /** HarvestService injects this once at boot via setLineage(). */
  setLineage(lineage: LineageService): void {
    this.lineage = lineage;
  }

  /**
   * HarvestService injects DbnomicsClient into every harvester at boot so
   * subclasses can use {@link tryDbnomicsFallback} as a graceful resort
   * whenever their primary source 4xx/5xx's, times out, or returns empty.
   */
  setDbnomics(client: DbnomicsClient): void {
    this.dbnomics = client;
  }

  /** HarvestService sets this for manual triggers; reset back to null after. */
  setNextRunKind(kind: DatasetRunKind | null): void {
    this.runKindOverride = kind;
  }

  /**
   * Universal DBnomics fallback. Subclasses pass a primary fetcher and one
   * or more candidate DBnomics series codes; if every series resolves to a
   * non-empty observation array, we return those. Otherwise we surface the
   * primary's result (which may itself be an empty array) so the caller can
   * decide how to react. The boolean `usedFallback` lets the caller stamp
   * the dataset metadata for observability.
   *
   * The fallback is intentionally additive — it never throws — so a
   * harvester can safely chain it onto its own try/catch without bringing
   * the whole pipeline down when DBnomics itself is unreachable.
   */
  protected async fetchWithDbnomicsFallback<T>(opts: {
    primary: () => Promise<T[]>;
    series: string[] | string;
    transform: (observations: DbnomicsObservation[], seriesCode: string) => T[];
    label: string;
  }): Promise<{ data: T[]; usedFallback: boolean; seriesUsed: string | null }> {
    const seriesList = Array.isArray(opts.series) ? opts.series : [opts.series];
    let primaryError: Error | null = null;
    try {
      const primary = await opts.primary();
      if (Array.isArray(primary) && primary.length > 0) {
        return { data: primary, usedFallback: false, seriesUsed: null };
      }
      this.logger.warn(
        `${opts.label}: primary returned 0 records — trying DBnomics fallback.`,
      );
    } catch (err) {
      primaryError = err as Error;
      this.logger.warn(
        `${opts.label}: primary failed (${primaryError.message}) — trying DBnomics fallback.`,
      );
    }

    if (!this.dbnomics) {
      if (primaryError) throw primaryError;
      return { data: [], usedFallback: false, seriesUsed: null };
    }

    for (const seriesCode of seriesList) {
      try {
        const obs = await this.dbnomics.fetchSeries(seriesCode);
        if (obs.length === 0) continue;
        const records = opts.transform(obs, seriesCode);
        if (records.length === 0) continue;
        this.logger.log(
          `${opts.label}: DBnomics fallback ${seriesCode} → ${records.length} records.`,
        );
        return { data: records, usedFallback: true, seriesUsed: seriesCode };
      } catch (err) {
        this.logger.warn(
          `${opts.label}: DBnomics ${seriesCode} failed: ${(err as Error).message}`,
        );
      }
    }

    if (primaryError) throw primaryError;
    return { data: [], usedFallback: false, seriesUsed: null };
  }

  /**
   * Push a harvested dataset through the configured loader, then archive
   * the JSON for human inspection. The whole call is bracketed by a
   * lineage run (when a LineageService is wired) so admin "delete this
   * file's data and all derivatives" can find every row later.
   */
  protected async persist(dataset: HarvestedDataset): Promise<void> {
    let runId: string | null = null;

    if (this.lineage) {
      try {
        const opened = await this.lineage.openRun(this.sourceId, {
          kind: this.runKindOverride ?? 'cron',
          ensureSource: {
            displayName: this.sourceName,
            sourceUrl: this.sourceUrl,
            cron: this.cronExpression,
            category: this.sourceCategory ?? dataset.category ?? null,
            sourceKind: 'harvester',
          },
        });
        runId = opened.runId;
      } catch (err) {
        this.logger.warn(
          `Lineage openRun failed for ${this.sourceId}: ${(err as Error).message}. Continuing without run tagging.`,
        );
      }
    }

    let recordCount = 0;
    let error: string | null = null;
    let archivePath: string | null = null;
    try {
      const result = await this.loader.load(dataset, { runId });
      recordCount = result.persisted;
      if (result.persisted > 0) {
        this.logger.log(
          `✅ ${this.sourceId} → ${this.loader.name}: ${result.persisted} rows persisted${
            result.note ? ` (${result.note})` : ''
          }`,
        );
      } else if (result.note) {
        this.logger.warn(
          `⏭ ${this.sourceId} → ${this.loader.name}: ${result.note}`,
        );
      }
    } catch (err: any) {
      error = err?.message ?? 'unknown loader error';
      this.logger.error(
        `${this.sourceId} loader=${this.loader.name} failed: ${error}`,
      );
    }

    try {
      archivePath = await this.storage.archive(dataset, runId);
    } catch (err) {
      this.logger.warn(
        `Archive failed for ${this.sourceId}: ${(err as Error).message}`,
      );
    }

    if (this.lineage && runId) {
      try {
        await this.lineage.closeRun(runId, {
          status: error ? 'failed' : 'ok',
          recordCount,
          error,
          archivePath,
        });
      } catch (err) {
        this.logger.warn(
          `Lineage closeRun failed for ${runId}: ${(err as Error).message}`,
        );
      }
    }

    // Reset the per-call kind override so the next cron tick uses the default.
    this.runKindOverride = null;
  }

  protected nextRun(cron: string): string {
    const parts = cron.split(' ');
    const now = new Date();
    if (parts[4] !== '*') now.setDate(now.getDate() + 7);
    else if (parts[2] !== '*') now.setDate(now.getDate() + 30);
    else now.setDate(now.getDate() + 1);
    return now.toISOString();
  }

  /** Parse a World Bank JSON response [meta, records] → normalized records */
  protected parseWorldBank(raw: any[]): {
    meta: any;
    records: Record<string, any>[];
  } {
    const [meta, data] = Array.isArray(raw) ? raw : [raw, []];
    const records = (data || [])
      .filter((r: any) => r.value !== null && r.value !== undefined)
      .map((r: any) => ({
        country: r.country?.value,
        countryCode: r.countryiso3code,
        year: parseInt(r.date, 10),
        value:
          typeof r.value === 'number'
            ? parseFloat(r.value.toFixed(4))
            : r.value,
        unit: r.unit || '',
        indicatorId: r.indicator?.id,
        indicatorName: r.indicator?.value,
      }));
    return { meta, records };
  }

  protected async fetchAllWorldBankPages(
    baseUrl: string,
  ): Promise<Record<string, any>[]> {
    let page = 1;
    let totalPages = 1;
    const all: Record<string, any>[] = [];
    do {
      const url = `${baseUrl}&page=${page}`;
      const { data } = await this.http.get(url);
      const [meta, records] = Array.isArray(data) ? data : [data, []];
      if (page === 1) totalPages = meta?.pages || 1;
      const filtered = (records || []).filter(
        (r: any) => r.value !== null && r.value !== undefined,
      );
      all.push(...filtered);
      page++;
    } while (page <= totalPages && page <= 20);
    return all;
  }

  protected parseCsv(text: string): Record<string, any>[] {
    try {
      return csvParse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch {
      const lines = text
        .trim()
        .split('\n')
        .filter((l) => l.trim());
      if (lines.length < 2) return [];
      const headers = lines[0]
        .split(',')
        .map((h) => h.replace(/"/g, '').trim());
      return lines.slice(1).map((line) => {
        const vals = line.split(',').map((v) => v.replace(/"/g, '').trim());
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
      });
    }
  }

  protected makeDataset(
    partial: Omit<
      HarvestedDataset,
      | 'lastFetched'
      | 'nextScheduled'
      | 'cronExpression'
      | 'fields'
      | 'recordCount'
    > & { records: Record<string, any>[] },
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
