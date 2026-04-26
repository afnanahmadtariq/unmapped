import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../storage/storage.service';
import { PostgresLoader } from '../../storage/postgres.loader';
import { BaseHarvester } from '../base.harvester';

// ILO ISCO-08 Occupation Classification — Public
// Fetches the full occupation classification dictionary from ILO ILOSTAT
// The classif1 dictionary contains ISCO-08 codes with labels
@Injectable()
export class IloIscoHarvester extends BaseHarvester {
  get sourceId() {
    return 'ilo-isco';
  }
  get cronExpression() {
    return '0 5 1 * *';
  } // 1st of every month 05:00

  constructor(storage: StorageService, loader: PostgresLoader) {
    super(storage, loader);
  }

  @Cron('0 5 1 * *')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting ILO ISCO-08...');

    // The ILO metadata dictionary for classif1 contains occupation classifications
    const url = 'https://rplumber.ilo.org/metadata/dic?lang=en&id=classif1';
    const { data, headers } = await this.http.get(url, {
      responseType: 'text',
    });
    const ct = String(
      (headers['content-type'] as string | string[] | undefined) ?? '',
    );

    let rows: Record<string, any>[] = [];
    if (ct.includes('json')) {
      rows = Array.isArray(data) ? data : [];
    } else {
      rows = this.parseCsv(data as string);
    }

    // Filter to only ISCO-08 entries (code starts with ISCO08_)
    const isco08 = rows.filter((r: any) => {
      const code = String(r['classif1'] || r['id'] || r['code'] || '');
      return code.startsWith('ISCO08_') || code.includes('ISCO');
    });

    const records = (isco08.length > 0 ? isco08 : rows).map((r: any) => ({
      code: r['classif1'] || r['id'] || r['code'] || '',
      label: r['label'] || r['classif1.label'] || r['description'] || '',
      level: r['level'] || '',
      parent: r['parent'] || '',
      langCode: r['lang'] || 'en',
    }));

    if (records.length === 0) {
      this.logger.warn(
        `ILO ISCO: no records returned (total rows: ${rows.length})`,
      );
    }

    await this.persist(
      this.makeDataset({
        sourceId: this.sourceId,
        sourceName: 'ILO ISCO-08',
        category: 'labor',
        metadata: {
          apiUrl: 'https://rplumber.ilo.org/__docs__/',
          description:
            'International Standard Classification of Occupations 2008',
          note: 'No API key required.',
          rawRowCount: rows.length,
        },
        records,
      }),
    );
  }
}
