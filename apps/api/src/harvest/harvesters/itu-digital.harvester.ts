import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../storage/storage.service';
import { PostgresLoader } from '../../storage/postgres.loader';
import { BaseHarvester } from '../base.harvester';

// ITU Digital Development — via World Bank WDI (no auth)
@Injectable()
export class ItuDigitalHarvester extends BaseHarvester {
  get sourceId() {
    return 'itu-digital';
  }
  get sourceName() {
    return 'ITU Digital Development (via World Bank)';
  }
  get sourceUrl() {
    return 'https://www.itu.int/en/ITU-D/Statistics/';
  }
  get sourceCategory() {
    return 'automation';
  }
  get cronExpression() {
    return '0 4 * * 2';
  }

  constructor(storage: StorageService, loader: PostgresLoader) {
    super(storage, loader);
  }

  private readonly indicators = [
    {
      id: 'IT.NET.USER.ZS',
      name: 'Individuals using the Internet (% of population)',
      dbnomicsSeries: 'WB/WDI/IT.NET.USER.ZS-WLD',
    },
    {
      id: 'IT.CEL.SETS.P2',
      name: 'Mobile cellular subscriptions (per 100 people)',
      dbnomicsSeries: 'WB/WDI/IT.CEL.SETS.P2-WLD',
    },
    {
      id: 'IT.NET.BBND.P2',
      name: 'Fixed broadband subscriptions (per 100 people)',
      dbnomicsSeries: 'WB/WDI/IT.NET.BBND.P2-WLD',
    },
    {
      id: 'IT.MLT.MAIN.P2',
      name: 'Fixed telephone subscriptions (per 100 people)',
      dbnomicsSeries: 'WB/WDI/IT.MLT.MAIN.P2-WLD',
    },
    {
      id: 'IT.NET.SECR.P6',
      name: 'Secure Internet servers (per 1 million people)',
      dbnomicsSeries: 'WB/WDI/IT.NET.SECR.P6-WLD',
    },
  ];

  @Cron('0 4 * * 2')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting ITU Digital Development...');
    const allRecords: Record<string, any>[] = [];
    let dbnomicsUsed = 0;

    for (const ind of this.indicators) {
      try {
        const result = await this.fetchWithDbnomicsFallback({
          label: `ITU/${ind.id}`,
          series: ind.dbnomicsSeries,
          primary: () => this.fetchItuIndicator(ind),
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
          `ITU ${ind.id} unavailable from primary and DBnomics: ${(err as Error).message}`,
        );
      }
    }

    await this.persist(
      this.makeDataset({
        sourceId: this.sourceId,
        sourceName: 'ITU Digital Development (via World Bank)',
        category: 'automation',
        metadata: {
          apiUrl: 'https://www.itu.int/en/ITU-D/Statistics/',
          worldBankMirror: 'https://api.worldbank.org/v2/',
          indicators: this.indicators,
          dbnomicsFallbacks: dbnomicsUsed,
          note: 'No API key required. ITU data mirrored via World Bank WDI.',
        },
        records: allRecords,
      }),
    );
  }

  private async fetchItuIndicator(ind: {
    id: string;
    name: string;
  }): Promise<Record<string, any>[]> {
    const rawRows = await this.fetchAllWorldBankPages(
      `https://api.worldbank.org/v2/country/all/indicator/${ind.id}?format=json&per_page=300&mrv=5`,
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
