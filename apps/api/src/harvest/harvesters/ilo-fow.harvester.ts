import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../storage/storage.service';
import { PostgresLoader } from '../../storage/postgres.loader';
import { BaseHarvester } from '../base.harvester';

// ILO Future of Work Datasets — Public (same rplumber.ilo.org API)
// Focuses on future-of-work relevant indicators
@Injectable()
export class IloFowHarvester extends BaseHarvester {
  get sourceId() {
    return 'ilo-fow';
  }
  get cronExpression() {
    return '0 2 * * 2';
  } // Every Tuesday 02:00

  constructor(storage: StorageService, loader: PostgresLoader) {
    super(storage, loader);
  }

  private readonly indicators = [
    { id: 'SDG_C821_SEX_RT', name: 'Labour income share (%)' },
    {
      id: 'EAR_INEE_SEX_ECO_NB',
      name: 'Mean nominal monthly earnings by sex and economic activity',
    },
    { id: 'IFL_XEES_SEX_RT', name: 'Informal employment rate (%)' },
    { id: 'SOC_PROT_COVRGE_RT', name: 'Social protection coverage rate (%)' },
  ];

  @Cron('0 2 * * 2')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting ILO Future of Work...');
    const allRecords: Record<string, any>[] = [];

    for (const indicator of this.indicators) {
      try {
        const url = `https://rplumber.ilo.org/data/indicator?id=${indicator.id}&lang=en&limit=500`;
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

        rows.forEach((r) =>
          allRecords.push({
            indicatorId: indicator.id,
            indicatorName: indicator.name,
            refArea: r['ref_area'] || r['ref_area.label'] || '',
            sex: r['sex'] || r['sex.label'] || '',
            time: r['time'] || '',
            obs_value: parseFloat(r['obs_value']) || null,
            obs_status: r['obs_status'] || '',
          }),
        );
      } catch (err: any) {
        this.logger.warn(`ILO FoW ${indicator.id} failed: ${err.message}`);
      }
    }

    await this.persist(
      this.makeDataset({
        sourceId: this.sourceId,
        sourceName: 'ILO Future of Work Datasets',
        category: 'automation',
        metadata: {
          apiUrl: 'https://rplumber.ilo.org/__docs__/',
          indicators: this.indicators,
          note: 'No API key required.',
        },
        records: allRecords,
      }),
    );
  }
}
