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
  get cronExpression() {
    return '0 3 * * 1';
  } // Every Monday 03:00

  constructor(storage: StorageService, loader: PostgresLoader) {
    super(storage, loader);
  }

  private readonly indicators = [
    { id: 'SL.UEM.TOTL.ZS', name: 'Unemployment rate, total (%)' },
    { id: 'SL.TLF.CACT.ZS', name: 'Labor force participation rate (%)' },
    { id: 'SL.EMP.VULN.ZS', name: 'Vulnerable employment, total (%)' },
    {
      id: 'SL.GDP.PCAP.EM.KD',
      name: 'GDP per person employed (constant 2017 PPP $)',
    },
    { id: 'SP.POP.TOTL', name: 'Population, total' },
    { id: 'NY.GDP.MKTP.CD', name: 'GDP (current US$)' },
  ];

  @Cron('0 3 * * 1')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting World Bank WDI...');
    const allRecords: Record<string, any>[] = [];

    for (const ind of this.indicators) {
      try {
        // mrv=5 = most recent 5 years, per_page=300 covers all countries in one page
        const rawRows = await this.fetchAllWorldBankPages(
          `https://api.worldbank.org/v2/country/all/indicator/${ind.id}?format=json&per_page=300&mrv=5`,
        );
        rawRows.forEach((r) =>
          allRecords.push({
            indicatorId: ind.id,
            indicatorName: ind.name,
            country: r.country?.value,
            countryCode: r.countryiso3code,
            year: parseInt(r.date, 10),
            value:
              r.value !== null
                ? parseFloat((r.value as number).toFixed(4))
                : null,
          }),
        );
      } catch (err: any) {
        this.logger.warn(`WDI ${ind.id} failed: ${err.message}`);
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
          note: 'No API key required. Publicly accessible.',
        },
        records: allRecords,
      }),
    );
  }
}
