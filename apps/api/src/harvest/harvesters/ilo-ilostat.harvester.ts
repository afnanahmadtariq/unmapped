import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../storage/storage.service';
import { PostgresLoader } from '../../storage/postgres.loader';
import { BaseHarvester } from '../base.harvester';

// ILO ILOSTAT Public API — rplumber.ilo.org
// Fetches multiple key labor market indicators per country
// Returns CSV, converted to normalized JSON
@Injectable()
export class IloIlostatHarvester extends BaseHarvester {
  get sourceId() { return 'ilo-ilostat'; }
  get cronExpression() { return '0 2 * * 1'; } // Every Monday 02:00

  constructor(storage: StorageService, loader: PostgresLoader) {
    super(storage, loader);
  }

  // Key ILO indicators to harvest
  private readonly indicators = [
    { id: 'EMP_TEMP_SEX_AGE_NB', name: 'Employment by sex and age (thousands)' },
    { id: 'UNE_DEAP_SEX_AGE_RT', name: 'Unemployment rate by sex and age (%)' },
    { id: 'HOW_TEMP_SEX_NB', name: 'Mean weekly hours worked by sex' },
  ];

  @Cron('0 2 * * 1')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting ILO ILOSTAT...');
    const allRecords: Record<string, any>[] = [];

    for (const indicator of this.indicators) {
      try {
        // Fetch global data — ILO returns CSV
        const url = `https://rplumber.ilo.org/data/indicator?id=${indicator.id}&lang=en&limit=500`;
        const { data, headers } = await this.http.get(url, { responseType: 'text' });
        const ct = String(headers['content-type'] ?? '');

        let rows: Record<string, any>[] = [];
        if (ct.includes('json')) {
          rows = Array.isArray(data) ? data : [];
        } else {
          // ILO returns CSV as octet-stream
          rows = this.parseCsv(data as string);
        }

        rows.forEach(r => allRecords.push({
          indicatorId: indicator.id,
          indicatorName: indicator.name,
          refArea: r['ref_area'] || r['ref_area.label'] || '',
          sex: r['sex'] || r['sex.label'] || '',
          classif1: r['classif1'] || r['classif1.label'] || '',
          time: r['time'] || r['time.label'] || '',
          obs_value: parseFloat(r['obs_value']) || null,
          obs_status: r['obs_status'] || '',
        }));
      } catch (err: any) {
        this.logger.warn(`ILO indicator ${indicator.id} failed: ${err.message}`);
      }
    }

    if (allRecords.length === 0) {
      this.logger.warn('ILO ILOSTAT returned no records');
      return;
    }

    await this.persist(this.makeDataset({
      sourceId: this.sourceId,
      sourceName: 'ILO ILOSTAT',
      category: 'labor',
      metadata: {
        apiUrl: 'https://rplumber.ilo.org/__docs__/',
        indicators: this.indicators,
        note: 'No API key required. Data updated quarterly by ILO.',
      },
      records: allRecords,
    }));
  }
}
