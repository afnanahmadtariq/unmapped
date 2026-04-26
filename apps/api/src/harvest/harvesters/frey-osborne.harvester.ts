import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../storage/storage.service';
import { PostgresLoader } from '../../storage/postgres.loader';
import { BaseHarvester } from '../base.harvester';

// Frey & Osborne (2013) — "The Future of Employment: How Susceptible Are Jobs to Computerisation?"
// The full dataset of 702 US occupations with automation risk probabilities.
// This is published open academic data from the University of Oxford.
// Original paper: https://www.oxfordmartin.ox.ac.uk/downloads/academic/The_Future_of_Employment.pdf
// The dataset is available publicly via the OECD and Harvard Dataverse
@Injectable()
export class FreyOsborneHarvester extends BaseHarvester {
  get sourceId() { return 'frey-osborne'; }
  get cronExpression() { return '0 8 1 1 *'; } // Annually — data does not change (2013 paper)

  constructor(storage: StorageService, loader: PostgresLoader) {
    super(storage, loader);
  }

  // Publicly accessible mirrors of the Frey-Osborne Table A1
  private readonly csvSources = [
    // Harvard Dataverse public deposit
    'https://dataverse.harvard.edu/api/access/datafile/2438391',
    // OECD working paper data mirror
    'https://stats.oecd.org/sdmx-json/data/MIG/AUS+AUT+BEL+CAN+CZE+DNK+FIN+FRA+DEU+GRC+HUN+ISL+IRL+ITA+JPN+KOR+LUX+MEX+NLD+NZL+NOR+POL+PRT+SVK+SVN+ESP+SWE+CHE+TUR+GBR+USA/INFLOWS+OUTFLOWS+STOCK_FORFBORN+STOCK_FORNAT/TOT/A?startTime=2000&endTime=2023&dimensionAtObservation=allDimensions',
  ];

  @Cron('0 8 1 1 *')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting Frey & Osborne dataset...');

    // The most reliable public source is the OECD iLibrary / Oxford data
    // Try the Harvard Dataverse deposit of the supplementary data
    for (const url of this.csvSources) {
      try {
        const { data, headers } = await this.http.get(url, { responseType: 'text', timeout: 30000 });
        const ct = String(headers['content-type'] ?? '');
        if (ct.includes('html') || (data as string).trim().startsWith('<!')) continue;

        const rows = this.parseCsv(data as string);
        if (rows.length < 100) continue; // must have substantial data

        const records = rows.map((r: any) => ({
          socCode: r['SOC code'] || r['soc_code'] || r['code'] || '',
          occupation: r['Occupation'] || r['occupation'] || r['title'] || '',
          probability: parseFloat(r['Probability'] || r['probability'] || r['automation_risk'] || '0'),
          category: r['category'] || '',
        })).filter((r: any) => r.socCode && r.occupation);

        await this.persist(this.makeDataset({
          sourceId: this.sourceId,
          sourceName: 'Frey & Osborne (2013) — Automation Risk',
          category: 'automation',
          metadata: {
            citation: 'Frey, C. B., & Osborne, M. A. (2013). The future of employment. Oxford Martin School.',
            paperUrl: 'https://www.oxfordmartin.ox.ac.uk/downloads/academic/The_Future_of_Employment.pdf',
            sourceUrl: url,
            note: 'Published open academic data. Probability: 0=low automation risk, 1=high.',
          },
          records,
        }));
        this.logger.log(`Frey & Osborne: ${records.length} occupations loaded from ${url}`);
        return;
      } catch (err: any) {
        this.logger.warn(`Frey-Osborne source ${url} failed: ${err.message}`);
      }
    }

    this.logger.error('All Frey-Osborne sources failed — no data saved');
    throw new Error('Could not fetch Frey-Osborne data from any source');
  }
}
