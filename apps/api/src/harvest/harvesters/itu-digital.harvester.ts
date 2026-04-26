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
    },
    {
      id: 'IT.CEL.SETS.P2',
      name: 'Mobile cellular subscriptions (per 100 people)',
    },
    {
      id: 'IT.NET.BBND.P2',
      name: 'Fixed broadband subscriptions (per 100 people)',
    },
    {
      id: 'IT.MLT.MAIN.P2',
      name: 'Fixed telephone subscriptions (per 100 people)',
    },
    {
      id: 'IT.NET.SECR.P6',
      name: 'Secure Internet servers (per 1 million people)',
    },
  ];

  @Cron('0 4 * * 2')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting ITU Digital Development...');
    const allRecords: Record<string, any>[] = [];

    for (const ind of this.indicators) {
      try {
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
        this.logger.warn(`ITU ${ind.id} failed: ${err.message}`);
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
          note: 'No API key required. ITU data mirrored via World Bank WDI.',
        },
        records: allRecords,
      }),
    );
  }
}
