import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../storage/storage.service';
import { PostgresLoader } from '../../storage/postgres.loader';
import { BaseHarvester } from '../base.harvester';

// UNESCO UIS via World Bank Education Stats (Source 12) — No auth required
// Source 12 mirrors UNESCO Institute for Statistics data
@Injectable()
export class UnescoUisHarvester extends BaseHarvester {
  get sourceId() {
    return 'unesco-uis';
  }
  get sourceName() {
    return 'UNESCO UIS (via World Bank)';
  }
  get sourceUrl() {
    return 'https://apiportal.uis.unesco.org/';
  }
  get sourceCategory() {
    return 'education';
  }
  get cronExpression() {
    return '0 3 8 * *';
  } // 8th of every month

  constructor(storage: StorageService, loader: PostgresLoader) {
    super(storage, loader);
  }

  // DBnomics carries the same UNESCO/EdStats series under the WB/EDSTATS
  // provider — so we can fall back when the WB API is rate-limiting.
  private readonly indicators = [
    {
      id: 'SE.ADT.LITR.ZS',
      name: 'Adult literacy rate (%)',
      dbnomicsSeries: 'WB/EDSTATS/SE.ADT.LITR.ZS-WLD',
    },
    {
      id: 'SE.PRM.ENRR',
      name: 'Primary school enrollment rate (%)',
      dbnomicsSeries: 'WB/EDSTATS/SE.PRM.ENRR-WLD',
    },
    {
      id: 'SE.SEC.ENRR',
      name: 'Secondary school enrollment rate (%)',
      dbnomicsSeries: 'WB/EDSTATS/SE.SEC.ENRR-WLD',
    },
    {
      id: 'SE.TER.ENRR',
      name: 'Tertiary school enrollment rate (%)',
      dbnomicsSeries: 'WB/EDSTATS/SE.TER.ENRR-WLD',
    },
    {
      id: 'SE.XPD.TOTL.GD.ZS',
      name: 'Govt. expenditure on education (% of GDP)',
      dbnomicsSeries: 'WB/EDSTATS/SE.XPD.TOTL.GD.ZS-WLD',
    },
    {
      id: 'SE.PRM.CMPT.ZS',
      name: 'Primary school completion rate (%)',
      dbnomicsSeries: 'WB/EDSTATS/SE.PRM.CMPT.ZS-WLD',
    },
  ];

  @Cron('0 3 8 * *')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting UNESCO UIS...');
    const allRecords: Record<string, any>[] = [];
    let dbnomicsUsed = 0;

    for (const ind of this.indicators) {
      try {
        const result = await this.fetchWithDbnomicsFallback({
          label: `UNESCO/${ind.id}`,
          series: ind.dbnomicsSeries,
          primary: () => this.fetchUisIndicator(ind),
          transform: (observations) =>
            observations.map((obs) => ({
              indicatorId: ind.id,
              indicatorName: ind.name,
              country: 'World',
              countryCode: 'WLD',
              year: obs.year,
              value: parseFloat(obs.value.toFixed(4)),
              source: 'dbnomics-fallback',
            })),
        });
        if (result.usedFallback) dbnomicsUsed += 1;
        allRecords.push(...result.data);
      } catch (err) {
        this.logger.warn(
          `UNESCO UIS ${ind.id} unavailable from primary and DBnomics: ${(err as Error).message}`,
        );
      }
    }

    await this.persist(
      this.makeDataset({
        sourceId: this.sourceId,
        sourceName: 'UNESCO Institute for Statistics (via World Bank)',
        category: 'education',
        metadata: {
          apiUrl: 'https://api.worldbank.org/v2/',
          directUisUrl: 'https://apiportal.uis.unesco.org/',
          indicators: this.indicators,
          dbnomicsFallbacks: dbnomicsUsed,
          note: 'No API key required. Sourced from World Bank Education Stats (Source 12) which mirrors UNESCO UIS data.',
        },
        records: allRecords,
      }),
    );
  }

  private async fetchUisIndicator(ind: {
    id: string;
    name: string;
  }): Promise<Record<string, any>[]> {
    const rawRows = await this.fetchAllWorldBankPages(
      `https://api.worldbank.org/v2/country/all/indicator/${ind.id}?format=json&per_page=300&mrv=3&source=12`,
    );
    return rawRows.map((r) => ({
      indicatorId: ind.id,
      indicatorName: ind.name,
      country: r.country?.value,
      countryCode: r.countryiso3code,
      year: parseInt(r.date, 10),
      value:
        r.value !== null
          ? parseFloat((r.value as number).toFixed(4))
          : null,
    }));
  }
}
