import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../storage/storage.service';
import { PostgresLoader } from '../../storage/postgres.loader';
import { BaseHarvester } from '../base.harvester';

// UN Population Division — Public (no auth required)
// API docs: https://population.un.org/dataportal/about/dataapi
// Endpoints are publicly accessible without a key
@Injectable()
export class UnPopulationHarvester extends BaseHarvester {
  get sourceId() { return 'un-population'; }
  get cronExpression() { return '0 6 1 * *'; } // 1st of every month

  constructor(storage: StorageService, loader: PostgresLoader) {
    super(storage, loader);
  }

  // Key indicators:
  // 49 = Total Population (both sexes, thousands)
  // 65 = Life expectancy at birth
  // 10 = Births
  // 59 = Deaths
  // 78 = Net migration rate
  private readonly indicators = [
    { id: 49, name: 'Total Population (thousands)' },
    { id: 65, name: 'Life Expectancy at Birth (years)' },
    { id: 78, name: 'Net Migration Rate' },
  ];

  // Key location groups
  private readonly locations = [
    { id: 900, name: 'World' },
    { id: 903, name: 'More Developed Regions' },
    { id: 904, name: 'Less Developed Regions' },
  ];

  @Cron('0 6 1 * *')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting UN Population...');
    const allRecords: Record<string, any>[] = [];

    for (const ind of this.indicators) {
      for (const loc of this.locations) {
        try {
          const url = `https://population.un.org/dataportalapi/api/v1/data/indicators/${ind.id}/locations/${loc.id}/start/2000/end/2030`;
          const { data } = await this.http.get(url);

          // API returns { data: [...], nextPage: "..." } with pagination
          let records = data.data || [];
          // Follow pagination if needed
          let nextUrl = data.nextPage;
          while (nextUrl && records.length < 2000) {
            const { data: nextData } = await this.http.get(nextUrl);
            records = [...records, ...(nextData.data || [])];
            nextUrl = nextData.nextPage;
          }

          records.forEach((r: any) => allRecords.push({
            indicatorId: ind.id,
            indicatorName: ind.name,
            locationId: loc.id,
            locationName: loc.name,
            timeMid: r.timeMid,
            value: r.value,
            variantName: r.variantName,
            sex: r.sex || 'Both',
            ageLabel: r.ageLabel || 'All',
          }));
        } catch (err: any) {
          this.logger.warn(`UN Pop ${ind.id}/${loc.id} failed: ${err.message}`);
        }
      }
    }

    await this.persist(this.makeDataset({
      sourceId: this.sourceId,
      sourceName: 'UN Population Division',
      category: 'education',
      metadata: {
        apiUrl: 'https://population.un.org/dataportal/about/dataapi',
        indicators: this.indicators,
        locations: this.locations,
        note: 'Publicly accessible, no API key required. Data from World Population Prospects 2024.',
      },
      records: allRecords,
    }));
  }
}
