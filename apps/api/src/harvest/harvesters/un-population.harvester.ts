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
  get sourceId() {
    return 'un-population';
  }
  get sourceName() {
    return 'UN Population Division';
  }
  get sourceUrl() {
    return 'https://population.un.org/dataportal/about/dataapi';
  }
  get sourceCategory() {
    return 'education';
  }
  get cronExpression() {
    return '0 6 1 * *';
  } // 1st of every month

  constructor(storage: StorageService, loader: PostgresLoader) {
    super(storage, loader);
  }

  // Key indicators (id is the UN Population Division indicator number).
  // Each carries an optional DBnomics fallback series mapping the World
  // aggregate so we still get a baseline number when the UN API is down.
  private readonly indicators = [
    {
      id: 49,
      name: 'Total Population (thousands)',
      dbnomicsSeries: 'WB/WDI/SP.POP.TOTL-WLD',
      // WB reports raw count; UN reports thousands. Divide for parity.
      fallbackScale: 1 / 1000,
    },
    {
      id: 65,
      name: 'Life Expectancy at Birth (years)',
      dbnomicsSeries: 'WB/WDI/SP.DYN.LE00.IN-WLD',
      fallbackScale: 1,
    },
    {
      id: 78,
      name: 'Net Migration Rate',
      dbnomicsSeries: 'WB/WDI/SM.POP.NETM-WLD',
      fallbackScale: 1,
    },
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
    let dbnomicsUsed = 0;

    for (const ind of this.indicators) {
      const indicatorRecords: Record<string, any>[] = [];
      for (const loc of this.locations) {
        try {
          const url = `https://population.un.org/dataportalapi/api/v1/data/indicators/${ind.id}/locations/${loc.id}/start/2000/end/2030`;
          const { data } = await this.http.get(url);

          let records = data.data || [];
          let nextUrl = data.nextPage;
          while (nextUrl && records.length < 2000) {
            const { data: nextData } = await this.http.get(nextUrl);
            records = [...records, ...(nextData.data || [])];
            nextUrl = nextData.nextPage;
          }

          records.forEach((r: any) =>
            indicatorRecords.push({
              indicatorId: ind.id,
              indicatorName: ind.name,
              locationId: loc.id,
              locationName: loc.name,
              timeMid: r.timeMid,
              value: r.value,
              variantName: r.variantName,
              sex: r.sex || 'Both',
              ageLabel: r.ageLabel || 'All',
            }),
          );
        } catch (err: any) {
          this.logger.warn(`UN Pop ${ind.id}/${loc.id} failed: ${err.message}`);
        }
      }

      // Universal DBnomics fallback: if the UN API yielded nothing for this
      // indicator across every location group, pull the World series from
      // DBnomics so downstream signals don't go dark.
      if (indicatorRecords.length === 0 && this.dbnomics) {
        try {
          const obs = await this.dbnomics.fetchSeries(ind.dbnomicsSeries);
          if (obs.length > 0) {
            dbnomicsUsed += 1;
            obs.forEach((o) =>
              indicatorRecords.push({
                indicatorId: ind.id,
                indicatorName: ind.name,
                locationId: 900,
                locationName: 'World',
                timeMid: o.year,
                value: o.value * ind.fallbackScale,
                variantName: 'dbnomics-fallback',
                sex: 'Both',
                ageLabel: 'All',
              }),
            );
            this.logger.log(
              `UN Pop ${ind.id} → DBnomics fallback ${ind.dbnomicsSeries} (${obs.length} obs).`,
            );
          }
        } catch (err) {
          this.logger.warn(
            `UN Pop ${ind.id} DBnomics fallback failed: ${(err as Error).message}`,
          );
        }
      }

      allRecords.push(...indicatorRecords);
    }

    await this.persist(
      this.makeDataset({
        sourceId: this.sourceId,
        sourceName: 'UN Population Division',
        category: 'education',
        metadata: {
          apiUrl: 'https://population.un.org/dataportal/about/dataapi',
          indicators: this.indicators,
          locations: this.locations,
          dbnomicsFallbacks: dbnomicsUsed,
          note: 'Publicly accessible, no API key required. Data from World Population Prospects 2024.',
        },
        records: allRecords,
      }),
    );
  }
}
