import { Injectable, Logger } from '@nestjs/common';
import { SignalsService } from '../signals/signals.service';
import { IscoService } from '../taxonomies/isco/isco.service';
import type { DatasetLoader } from './loader.types';
import type { HarvestedDataset } from '../types/dataset.types';

/**
 * Postgres strategy — for harvesters whose category is `labor`,
 * `automation`, `education`. Routes records into the right entity
 * based on `dataset.category` and (when needed) the `sourceId`.
 *
 * Phase 4 contract: today only Frey-Osborne (`automation`) and World
 * Bank WDI (`labor`) and ISCO (`skills` -> ISCO when sourceId says so)
 * have target entities. Anything else logs a TODO and short-circuits
 * gracefully without erroring (so cron stays green).
 */
@Injectable()
export class PostgresLoader implements DatasetLoader {
  readonly name = 'postgres';
  private readonly logger = new Logger(PostgresLoader.name);

  constructor(
    private readonly signals: SignalsService,
    private readonly isco: IscoService,
  ) {}

  async load(dataset: HarvestedDataset) {
    switch (dataset.sourceId) {
      case 'frey-osborne':
        return this.loadFreyOsborne(dataset);
      case 'wb-wdi':
      case 'wb-hci':
        return this.loadWbIndicator(dataset);
      case 'ilo-isco':
        return this.loadIsco(dataset);
      default:
        return {
          persisted: 0,
          note: `TODO: enable PostgresLoader for sourceId=${dataset.sourceId} once entity is finalized.`,
        };
    }
  }

  private async loadFreyOsborne(dataset: HarvestedDataset) {
    const rows = (dataset.records ?? [])
      .map((r: any) => {
        const iscoCode =
          r.iscoCode ?? r.isco_code ?? r.iscoMapping ?? r.socCode ?? '';
        const probability = Number(r.probability ?? r.automation_risk ?? 0);
        if (!iscoCode || Number.isNaN(probability)) return null;
        return {
          iscoCode: String(iscoCode),
          probability: Math.max(0, Math.min(1, probability)),
          source: 'frey-osborne',
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const persisted = await this.signals.upsertFreyOsborne(rows);
    return { persisted };
  }

  private async loadWbIndicator(dataset: HarvestedDataset) {
    const rows = (dataset.records ?? [])
      .map((r: any) => {
        const iso3 = r.countryCode ?? r.iso3 ?? r.country?.id ?? '';
        const indicator = r.indicatorId ?? r.indicator?.id ?? '';
        const year = Number(r.year ?? r.date);
        const value =
          r.value !== null && r.value !== undefined ? Number(r.value) : null;
        if (
          !iso3 ||
          !indicator ||
          !year ||
          value === null ||
          Number.isNaN(value)
        )
          return null;
        return {
          iso3: String(iso3),
          indicator: String(indicator),
          year,
          value,
          source: dataset.sourceId,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const persisted = await this.signals.upsertWbIndicatorPoints(rows);
    return { persisted };
  }

  private async loadIsco(dataset: HarvestedDataset) {
    const rows = (dataset.records ?? [])
      .map((r: any) => {
        const code = String(r.code ?? r.iscoCode ?? '');
        const title = String(r.title ?? r.label ?? r.name ?? '');
        if (!code || !title) return null;
        return {
          code,
          title,
          skillLevel: r.skillLevel ?? null,
          sectorId: r.sectorId ?? null,
          source: 'ilo-isco',
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const persisted = await this.isco.upsertMany(rows);
    return { persisted };
  }
}
