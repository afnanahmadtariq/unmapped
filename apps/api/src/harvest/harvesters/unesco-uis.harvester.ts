import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../storage/storage.service';
import { BaseHarvester } from '../base.harvester';

// UNESCO UIS via World Bank Education Stats (Source 12) — No auth required
// Source 12 mirrors UNESCO Institute for Statistics data
@Injectable()
export class UnescoUisHarvester extends BaseHarvester {
  get sourceId() { return 'unesco-uis'; }
  get cronExpression() { return '0 3 8 * *'; } // 8th of every month

  constructor(storage: StorageService) { super(storage); }

  private readonly indicators = [
    { id: 'SE.ADT.LITR.ZS', name: 'Adult literacy rate (%)' },
    { id: 'SE.PRM.ENRR', name: 'Primary school enrollment rate (%)' },
    { id: 'SE.SEC.ENRR', name: 'Secondary school enrollment rate (%)' },
    { id: 'SE.TER.ENRR', name: 'Tertiary school enrollment rate (%)' },
    { id: 'SE.XPD.TOTL.GD.ZS', name: 'Govt. expenditure on education (% of GDP)' },
    { id: 'SE.PRM.CMPT.ZS', name: 'Primary school completion rate (%)' },
  ];

  @Cron('0 3 8 * *')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting UNESCO UIS...');
    const allRecords: Record<string, any>[] = [];

    for (const ind of this.indicators) {
      try {
        // Use source=12 for UNESCO/Education Stats database
        const rawRows = await this.fetchAllWorldBankPages(
          `https://api.worldbank.org/v2/country/all/indicator/${ind.id}?format=json&per_page=300&mrv=3&source=12`
        );
        rawRows.forEach(r => allRecords.push({
          indicatorId: ind.id,
          indicatorName: ind.name,
          country: r.country?.value,
          countryCode: r.countryiso3code,
          year: parseInt(r.date, 10),
          value: r.value !== null ? parseFloat((r.value as number).toFixed(4)) : null,
        }));
      } catch (err: any) {
        this.logger.warn(`UNESCO UIS ${ind.id} failed: ${err.message}`);
      }
    }

    await this.storage.save(this.makeDataset({
      sourceId: this.sourceId,
      sourceName: 'UNESCO Institute for Statistics (via World Bank)',
      category: 'education',
      metadata: {
        apiUrl: 'https://api.worldbank.org/v2/',
        directUisUrl: 'https://apiportal.uis.unesco.org/',
        indicators: this.indicators,
        note: 'No API key required. Sourced from World Bank Education Stats (Source 12) which mirrors UNESCO UIS data.',
      },
      records: allRecords,
    }));
  }
}
