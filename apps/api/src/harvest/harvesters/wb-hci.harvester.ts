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
  get cronExpression() {
    return '0 4 * * 1';
  }

  constructor(storage: StorageService, loader: PostgresLoader) {
    super(storage, loader);
  }

  private readonly indicators = [
    {
      id: 'HD.HCI.OVRL',
      name: 'Human Capital Index (HCI) — overall (scale 0-1)',
    },
    { id: 'HD.HCI.EYRS', name: 'Expected Years of School' },
    { id: 'HD.HCI.LAYS', name: 'Learning-Adjusted Years of School' },
    { id: 'HD.HCI.MORT', name: 'Child survival rate (probability)' },
    { id: 'HD.HCI.HLOS', name: 'Harmonized test scores' },
  ];

  @Cron('0 4 * * 1')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting World Bank HCI...');
    const allRecords: Record<string, any>[] = [];

    for (const ind of this.indicators) {
      try {
        const rawRows = await this.fetchAllWorldBankPages(
          `https://api.worldbank.org/v2/country/all/indicator/${ind.id}?format=json&per_page=300&mrv=1`,
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
        this.logger.warn(`HCI ${ind.id} failed: ${err.message}`);
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
          note: 'No API key required. HCI data last updated 2020.',
        },
        records: allRecords,
      }),
    );
  }
}
