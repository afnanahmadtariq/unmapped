import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../storage/storage.service';
import { PostgresLoader } from '../../storage/postgres.loader';
import { BaseHarvester } from '../base.harvester';

// ILO ILOSTAT Public API — rplumber.ilo.org
// Fetches multiple key labor market indicators per country
// Returns CSV, converted to normalized JSON. Each indicator has a
// DBnomics fallback series so the harvester degrades gracefully when
// the ILO API is rate-limiting or down.
@Injectable()
export class IloIlostatHarvester extends BaseHarvester {
  get sourceId() {
    return 'ilo-ilostat';
  }
  get sourceName() {
    return 'ILO ILOSTAT';
  }
  get sourceUrl() {
    return 'https://rplumber.ilo.org/__docs__/';
  }
  get sourceCategory() {
    return 'labor';
  }
  get cronExpression() {
    return '0 2 * * 1';
  } // Every Monday 02:00

  constructor(storage: StorageService, loader: PostgresLoader) {
    super(storage, loader);
  }

  // Key ILO indicators to harvest. Each carries an optional DBnomics
  // fallback series for the world aggregate; see plan.md "use DBnomics
  // where required".
  private readonly indicators = [
    {
      id: 'EMP_TEMP_SEX_AGE_NB',
      name: 'Employment by sex and age (thousands)',
      dbnomicsSeries: 'ILO/EMP_TEMP_SEX_AGE_NB',
    },
    {
      id: 'UNE_DEAP_SEX_AGE_RT',
      name: 'Unemployment rate by sex and age (%)',
      dbnomicsSeries: 'ILO/UNE_DEAP_SEX_AGE_RT',
    },
    {
      id: 'HOW_TEMP_SEX_NB',
      name: 'Mean weekly hours worked by sex',
      dbnomicsSeries: 'ILO/HOW_TEMP_SEX_NB',
    },
  ];

  @Cron('0 2 * * 1')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting ILO ILOSTAT...');
    const allRecords: Record<string, any>[] = [];
    let dbnomicsUsed = 0;

    for (const indicator of this.indicators) {
      try {
        const result = await this.fetchWithDbnomicsFallback({
          label: `ILOSTAT/${indicator.id}`,
          series: indicator.dbnomicsSeries,
          primary: () => this.fetchIloIndicator(indicator),
          transform: (observations) =>
            observations.map((obs) => ({
              indicatorId: indicator.id,
              indicatorName: indicator.name,
              refArea: 'WORLD',
              sex: 'T',
              classif1: 'AGGREGATE',
              time: obs.period,
              obs_value: obs.value,
              obs_status: 'dbnomics-fallback',
            })),
        });
        if (result.usedFallback) dbnomicsUsed += 1;
        allRecords.push(...result.data);
      } catch (err) {
        this.logger.warn(
          `ILO indicator ${indicator.id} unavailable from primary and DBnomics: ${(err as Error).message}`,
        );
      }
    }

    if (allRecords.length === 0) {
      this.logger.warn('ILO ILOSTAT returned no records (after fallback)');
      return;
    }

    await this.persist(
      this.makeDataset({
        sourceId: this.sourceId,
        sourceName: 'ILO ILOSTAT',
        category: 'labor',
        metadata: {
          apiUrl: 'https://rplumber.ilo.org/__docs__/',
          indicators: this.indicators,
          dbnomicsFallbacks: dbnomicsUsed,
          note: 'No API key required. Data updated quarterly by ILO.',
        },
        records: allRecords,
      }),
    );
  }

  // Byte cap: skip CSV parsing when the response exceeds ~2 MB.
  // The large multi-country indicators (EMP_TEMP_SEX_AGE_NB, UNE_DEAP_SEX_AGE_RT)
  // can return 500 k+ rows as a synchronous string, which exhausts V8's call stack
  // inside csvParse. We truncate to the first MAX_ROWS lines instead.
  private readonly MAX_CSV_ROWS = 3000;

  private async fetchIloIndicator(indicator: {
    id: string;
    name: string;
  }): Promise<Record<string, any>[]> {
    const url = `https://rplumber.ilo.org/data/indicator?id=${indicator.id}&lang=en&limit=500`;
    const { data, headers } = await this.http.get(url, {
      responseType: 'text',
    });
    const ct = String(
      (headers['content-type'] as string | string[] | undefined) ?? '',
    );

    let rows: Record<string, any>[];
    if (ct.includes('json')) {
      rows = Array.isArray(data) ? data : [];
    } else {
      const text = data as string;
      // Guard against enormous CSVs that cause synchronous-parse stack overflow.
      const lines = text.split('\n');
      const safe =
        lines.length > this.MAX_CSV_ROWS + 1
          ? lines.slice(0, this.MAX_CSV_ROWS + 1).join('\n')
          : text;
      rows = this.parseCsv(safe);
    }

    return rows.map((r) => ({
      indicatorId: indicator.id,
      indicatorName: indicator.name,
      refArea: r['ref_area'] || r['ref_area.label'] || '',
      sex: r['sex'] || r['sex.label'] || '',
      classif1: r['classif1'] || r['classif1.label'] || '',
      time: r['time'] || r['time.label'] || '',
      obs_value: parseFloat(r['obs_value']) || null,
      obs_status: r['obs_status'] || '',
    }));
  }
}
