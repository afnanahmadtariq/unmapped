import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../storage/storage.service';
import { PostgresLoader } from '../../storage/postgres.loader';
import { BaseHarvester } from '../base.harvester';

// ILO Future of Work Datasets — Public (same rplumber.ilo.org API)
// Focuses on future-of-work relevant indicators
@Injectable()
export class IloFowHarvester extends BaseHarvester {
  get sourceId() {
    return 'ilo-fow';
  }
  get sourceName() {
    return 'ILO Future of Work Datasets';
  }
  get sourceUrl() {
    return 'https://rplumber.ilo.org/__docs__/';
  }
  get sourceCategory() {
    return 'automation';
  }
  get cronExpression() {
    return '0 2 * * 2';
  } // Every Tuesday 02:00

  constructor(storage: StorageService, loader: PostgresLoader) {
    super(storage, loader);
  }

  private readonly indicators = [
    {
      id: 'SDG_C821_SEX_RT',
      name: 'Labour income share (%)',
      dbnomicsSeries: 'ILO/SDG_C821_SEX_RT',
    },
    {
      id: 'EAR_INEE_SEX_ECO_NB',
      name: 'Mean nominal monthly earnings by sex and economic activity',
      dbnomicsSeries: 'ILO/EAR_INEE_SEX_ECO_NB',
    },
    {
      id: 'IFL_XEES_SEX_RT',
      name: 'Informal employment rate (%)',
      dbnomicsSeries: 'ILO/IFL_XEES_SEX_RT',
    },
    {
      id: 'SOC_PROT_COVRGE_RT',
      name: 'Social protection coverage rate (%)',
      dbnomicsSeries: 'ILO/SOC_PROT_COVRGE_RT',
    },
  ];

  @Cron('0 2 * * 2')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting ILO Future of Work...');
    const allRecords: Record<string, any>[] = [];
    let dbnomicsUsed = 0;

    for (const indicator of this.indicators) {
      try {
        const result = await this.fetchWithDbnomicsFallback({
          label: `ILO-FoW/${indicator.id}`,
          series: indicator.dbnomicsSeries,
          primary: () => this.fetchFowIndicator(indicator),
          transform: (observations) =>
            observations.map((obs) => ({
              indicatorId: indicator.id,
              indicatorName: indicator.name,
              refArea: 'WORLD',
              sex: 'T',
              time: obs.period,
              obs_value: obs.value,
              obs_status: 'dbnomics-fallback',
            })),
        });
        if (result.usedFallback) dbnomicsUsed += 1;
        allRecords.push(...result.data);
      } catch (err) {
        this.logger.warn(
          `ILO FoW ${indicator.id} unavailable from primary and DBnomics: ${(err as Error).message}`,
        );
      }
    }

    await this.persist(
      this.makeDataset({
        sourceId: this.sourceId,
        sourceName: 'ILO Future of Work Datasets',
        category: 'automation',
        metadata: {
          apiUrl: 'https://rplumber.ilo.org/__docs__/',
          indicators: this.indicators,
          dbnomicsFallbacks: dbnomicsUsed,
          note: 'No API key required.',
        },
        records: allRecords,
      }),
    );
  }

  private async fetchFowIndicator(indicator: {
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

    const rows: Record<string, any>[] = ct.includes('json')
      ? Array.isArray(data)
        ? data
        : []
      : this.parseCsv(data as string);

    return rows.map((r) => ({
      indicatorId: indicator.id,
      indicatorName: indicator.name,
      refArea: r['ref_area'] || r['ref_area.label'] || '',
      sex: r['sex'] || r['sex.label'] || '',
      time: r['time'] || '',
      obs_value: parseFloat(r['obs_value']) || null,
      obs_status: r['obs_status'] || '',
    }));
  }
}
