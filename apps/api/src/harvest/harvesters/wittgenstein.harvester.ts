import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../storage/storage.service';
import { PostgresLoader } from '../../storage/postgres.loader';
import { BaseHarvester } from '../base.harvester';

// Wittgenstein Centre — Public bulk CSV download (no auth, no API key)
// The WCDE provides projection data as downloadable CSV files
// URL pattern: https://www.wittgensteincentre.org/dataexplorer/wcde-v3-data/
@Injectable()
export class WittgensteinHarvester extends BaseHarvester {
  get sourceId() { return 'wittgenstein'; }
  get cronExpression() { return '0 7 1 1,4,7,10 *'; } // Quarterly (new projections released annually)

  constructor(storage: StorageService, loader: PostgresLoader) {
    super(storage, loader);
  }

  @Cron('0 7 1 1,4,7,10 *')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting Wittgenstein Centre data...');

    // WCDE provides a country-level summary CSV — public, no auth
    // This is the WCDE v3 education projection data
    const csvUrl = 'https://www.wittgensteincentre.org/dataexplorer/wcde-v3-data/wcde_v3_country.csv';

    try {
      const { data } = await this.http.get(csvUrl, { responseType: 'text', timeout: 60000 });
      const rows = this.parseCsv(data as string);

      const records = rows.map((r: any) => ({
        country: r['name'] || r['country'] || '',
        iso3: r['iso3'] || r['country_code'] || '',
        year: parseInt(r['year'] || r['period'] || '0', 10),
        scenario: r['scenario'] || r['ssp'] || '',
        educLevel: r['educ'] || r['education'] || '',
        sex: r['sex'] || '',
        agGroup: r['age'] || r['age_group'] || '',
        population: parseFloat(r['pop'] || r['population'] || '0') || null,
      }));

      await this.persist(this.makeDataset({
        sourceId: this.sourceId,
        sourceName: 'Wittgenstein Centre (WCDE v3)',
        category: 'education',
        metadata: {
          sourceUrl: csvUrl,
          dataExplorer: 'https://dataexplorer.wittgensteincentre.org/wcde/',
          note: 'Publicly downloadable CSV — no API key required. Education projections by age, sex, education level.',
        },
        records,
      }));
    } catch (err: any) {
      // Fallback: try the alternative download page path
      this.logger.warn(`Wittgenstein primary URL failed: ${err.message}. Trying alternative...`);
      try {
        const altUrl = 'https://www.oeaw.ac.at/fileadmin/subsites/Institute/VID/dataexplorer/wcde-v3-data/wcde_v3_country.csv';
        const { data } = await this.http.get(altUrl, { responseType: 'text', timeout: 60000 });
        const rows = this.parseCsv(data as string);
        await this.persist(this.makeDataset({
          sourceId: this.sourceId,
          sourceName: 'Wittgenstein Centre (WCDE v3)',
          category: 'education',
          metadata: { sourceUrl: altUrl, note: 'Via OeAW mirror. No API key required.' },
          records: rows,
        }));
      } catch (err2: any) {
        this.logger.error(`Wittgenstein harvest failed completely: ${err2.message}`);
        throw err2;
      }
    }
  }
}
