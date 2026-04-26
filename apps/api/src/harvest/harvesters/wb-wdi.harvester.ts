import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../storage/storage.service';
import { PostgresLoader } from '../../storage/postgres.loader';
import { BaseHarvester } from '../base.harvester';

// World Bank WDI — api.worldbank.org — No auth required
// Fetches key labor & economic development indicators for all countries
@Injectable()
export class WorldBankWdiHarvester extends BaseHarvester {
  get sourceId() {
    return 'wb-wdi';
  }
  get sourceName() {
    return 'World Bank WDI';
  }
  get sourceUrl() {
    return 'https://datahelpdesk.worldbank.org/knowledgebase/articles/898581';
  }
  get sourceCategory() {
    return 'labor';
  }
  get cronExpression() {
    return '0 3 * * 1';
  } // Every Monday 03:00

  constructor(storage: StorageService, loader: PostgresLoader) {
    super(storage, loader);
  }

  // DBnomics mirrors the WB WDI dataset 1:1 — series codes use the form
  // `WB/WDI/<INDICATOR>-<COUNTRY>`. We use `WLD` (world aggregate) as the
  // last-resort fallback when the WB API itself is unreachable.
  private readonly indicators = [
    {
      id: 'SL.UEM.TOTL.ZS',
      name: 'Unemployment rate, total (%)',
      dbnomicsSeries: 'WB/WDI/SL.UEM.TOTL.ZS-WLD',
    },
    {
      id: 'SL.TLF.CACT.ZS',
      name: 'Labor force participation rate (%)',
      dbnomicsSeries: 'WB/WDI/SL.TLF.CACT.ZS-WLD',
    },
    {
      id: 'SL.EMP.VULN.ZS',
      name: 'Vulnerable employment, total (%)',
      dbnomicsSeries: 'WB/WDI/SL.EMP.VULN.ZS-WLD',
    },
    {
      id: 'SL.GDP.PCAP.EM.KD',
      name: 'GDP per person employed (constant 2017 PPP $)',
      dbnomicsSeries: 'WB/WDI/SL.GDP.PCAP.EM.KD-WLD',
    },
    {
      id: 'SP.POP.TOTL',
      name: 'Population, total',
      dbnomicsSeries: 'WB/WDI/SP.POP.TOTL-WLD',
    },
    {
      id: 'NY.GDP.MKTP.CD',
      name: 'GDP (current US$)',
      dbnomicsSeries: 'WB/WDI/NY.GDP.MKTP.CD-WLD',
    },
  ];

  @Cron('0 3 * * 1')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting World Bank WDI...');
    const allRecords: Record<string, any>[] = [];
    let dbnomicsUsed = 0;

    for (const ind of this.indicators) {
      try {
        const result = await this.fetchWithDbnomicsFallback({
          label: `WDI/${ind.id}`,
          series: ind.dbnomicsSeries,
          primary: () => this.fetchWdiIndicator(ind),
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
          `WDI ${ind.id} unavailable from primary and DBnomics: ${(err as Error).message}`,
        );
      }
    }

    await this.persist(
      this.makeDataset({
        sourceId: this.sourceId,
        sourceName: 'World Bank WDI',
        category: 'labor',
        metadata: {
          apiUrl:
            'https://datahelpdesk.worldbank.org/knowledgebase/articles/898581',
          indicators: this.indicators,
          dbnomicsFallbacks: dbnomicsUsed,
          note: 'No API key required. Publicly accessible.',
        },
        records: allRecords,
      }),
    );
  }

  private async fetchWdiIndicator(ind: {
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
