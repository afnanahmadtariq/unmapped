import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../storage/storage.service';
import { VectorLoader } from '../../storage/vector.loader';
import { BaseHarvester } from '../base.harvester';

// ESCO Skills Taxonomy (EU) — Public REST API, no auth required
// Full taxonomy: ~13,890 skills + 3,008 occupations
// Docs: https://esco.ec.europa.eu/en/use-esco/esco-web-services
//
// Reference implementation for the Phase 4 loader pattern: writes
// Postgres rows AND embeds skill descriptions into Milvus via VectorLoader.
@Injectable()
export class EscoHarvester extends BaseHarvester {
  get sourceId() {
    return 'esco';
  }
  get sourceName() {
    return 'ESCO Skills Taxonomy (EU)';
  }
  get sourceUrl() {
    return 'https://esco.ec.europa.eu/en/use-esco/esco-web-services';
  }
  get sourceCategory() {
    return 'skills';
  }
  get cronExpression() {
    return '0 5 1 1,7 *';
  } // Every 6 months (ESCO updates ~annually)

  constructor(storage: StorageService, loader: VectorLoader) {
    super(storage, loader);
  }

  @Cron('0 5 1 1,7 *')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting ESCO Skills Taxonomy...');
    const allSkills: Record<string, any>[] = [];
    const allOccupations: Record<string, any>[] = [];

    // Harvest skills in batches of 100
    await this.fetchEscoType('skill', allSkills);
    await this.fetchEscoType('occupation', allOccupations);

    const allRecords = [
      ...allSkills.map((s) => ({ ...s, recordType: 'skill' })),
      ...allOccupations.map((o) => ({ ...o, recordType: 'occupation' })),
    ];

    await this.persist(
      this.makeDataset({
        sourceId: this.sourceId,
        sourceName: 'ESCO Skills Taxonomy (EU)',
        category: 'skills',
        metadata: {
          apiUrl: 'https://esco.ec.europa.eu/en/use-esco/esco-web-services',
          version: 'ESCO v1.1.1',
          totalSkills: allSkills.length,
          totalOccupations: allOccupations.length,
          note: 'No API key required. European Skills, Competences, Qualifications and Occupations taxonomy.',
        },
        records: allRecords,
      }),
    );
  }

  private async fetchEscoType(
    type: 'skill' | 'occupation',
    results: Record<string, any>[],
  ): Promise<void> {
    const limit = 100;
    let offset = 0;
    let total = Infinity;

    while (offset < total && offset < 5000) {
      // cap at 5000 per type
      try {
        const url = `https://ec.europa.eu/esco/api/search?language=en&type=${type}&offset=${offset}&limit=${limit}`;
        const { data } = await this.http.get(url);
        if (offset === 0) total = Math.min(data.total || 0, 5000);

        const items = (data._embedded?.results || []).map((item: any) => ({
          uri: item.uri,
          title: item.title,
          type: item.className,
          skillType: item.hasSkillType?.[0]?.split('/').pop() || null,
          reuseLevel: item.hasReuseLevel?.[0]?.split('/').pop() || null,
          iscoGroup:
            item.broaderHierarchyConcept?.[0]?.split('/').pop() || null,
        }));

        results.push(...items);
        offset += limit;

        if (items.length < limit) break; // last page
        await new Promise((r) => setTimeout(r, 200)); // be polite to the API
      } catch (err: any) {
        this.logger.warn(
          `ESCO ${type} offset=${offset} failed: ${err.message}`,
        );
        break;
      }
    }

    this.logger.log(`ESCO ${type}: fetched ${results.length} records`);
  }
}
