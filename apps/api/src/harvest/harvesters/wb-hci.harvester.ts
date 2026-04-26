import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../storage/storage.service';
import { PostgresLoader } from '../../storage/postgres.loader';
import { BaseHarvester } from '../base.harvester';

// World Bank Human Capital Index — No auth required
// Source 63 in WB (Human Capital Project)
@Injectable()
export class WorldBankHciHarvester extends BaseHarvester {
  get sourceId() {
    return 'wb-hci';
  }
  get sourceName() {
    return 'World Bank Human Capital Index';
  }
  get sourceUrl() {
    return 'https://datatopics.worldbank.org/human-capital/';
  }
  get sourceCategory() {
    return 'labor';
  }
  get cronExpression() {
    return '0 4 * * 1';
  }

  constructor(storage: StorageService, loader: PostgresLoader) {
    super(storage, loader);
  }

  // DBnomics mirrors WB indicators (incl. HCI) under WB/WDI; world aggregate
  // is the last-resort fallback when the WB API itself is unreachable.
  private readonly indicators = [
    {
      id: 'HD.HCI.OVRL',
      name: 'Human Capital Index (HCI) — overall (scale 0-1)',
      dbnomicsSeries: 'WB/WDI/HD.HCI.OVRL-WLD',
    },
    {
      id: 'HD.HCI.EYRS',
      name: 'Expected Years of School',
      dbnomicsSeries: 'WB/WDI/HD.HCI.EYRS-WLD',
    },
    {
      id: 'HD.HCI.LAYS',
      name: 'Learning-Adjusted Years of School',
      dbnomicsSeries: 'WB/WDI/HD.HCI.LAYS-WLD',
    },
    {
      id: 'HD.HCI.MORT',
      name: 'Child survival rate (probability)',
      dbnomicsSeries: 'WB/WDI/HD.HCI.MORT-WLD',
    },
    {
      id: 'HD.HCI.HLOS',
      name: 'Harmonized test scores',
      dbnomicsSeries: 'WB/WDI/HD.HCI.HLOS-WLD',
    },
  ];

  @Cron('0 4 * * 1')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting World Bank HCI...');
    const allRecords: Record<string, any>[] = [];
    let dbnomicsUsed = 0;

    for (const ind of this.indicators) {
      try {
        const result = await this.fetchWithDbnomicsFallback({
          label: `HCI/${ind.id}`,
          series: ind.dbnomicsSeries,
          primary: () => this.fetchHciIndicator(ind),
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
          `HCI ${ind.id} unavailable from primary and DBnomics: ${(err as Error).message}`,
        );
      }
    }

    await this.persist(
      this.makeDataset({
        sourceId: this.sourceId,
        sourceName: 'World Bank Human Capital Index',
        category: 'labor',
        metadata: {
          apiUrl: 'https://datatopics.worldbank.org/human-capital/',
          indicators: this.indicators,
          dbnomicsFallbacks: dbnomicsUsed,
          note: 'No API key required. HCI data last updated 2020.',
        },
        records: allRecords,
      }),
    );
  }

  private async fetchHciIndicator(ind: {
    id: string;
    name: string;
  }): Promise<Record<string, any>[]> {
    const rawRows = await this.fetchAllWorldBankPages(
      `https://api.worldbank.org/v2/country/all/indicator/${ind.id}?format=json&per_page=300&mrv=1`,
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
