import { Injectable, Logger } from '@nestjs/common';
import { EscoIngestService } from '../taxonomies/esco/esco-ingest.service';
import type { DatasetLoader } from './loader.types';
import type { HarvestedDataset } from '../types/dataset.types';

/**
 * Vector strategy — used by harvesters whose payload is *text* worth
 * embedding (ESCO skills today, O*NET tasks once that lands). It writes
 * to Postgres AND embeds into Milvus, so the system can do RAG retrieval
 * the moment harvest finishes.
 *
 * For now only the ESCO harvester routes here. O*NET will plug in via
 * the same shape once its harvester is added.
 */
@Injectable()
export class VectorLoader implements DatasetLoader {
  readonly name = 'vector';
  private readonly logger = new Logger(VectorLoader.name);

  constructor(private readonly escoIngest: EscoIngestService) {}

  async load(dataset: HarvestedDataset) {
    if (dataset.sourceId === 'esco') {
      return this.loadEsco(dataset);
    }
    return {
      persisted: 0,
      note: `TODO: enable VectorLoader for sourceId=${dataset.sourceId} once entity + collection are finalized.`,
    };
  }

  private async loadEsco(dataset: HarvestedDataset) {
    // ESCO harvester emits {recordType: 'skill' | 'occupation'} for every row.
    // We only embed *skills*; occupations go through PostgresLoader→ISCO once
    // the mapping table lands. Until then we skip them silently.
    const skills = (dataset.records ?? [])
      .filter((r: any) => r.recordType !== 'occupation')
      .map((r: any) => {
        const code =
          r.code ??
          r.uri?.split('/').pop() ??
          (typeof r.uri === 'string' ? r.uri.replace(/^.*\//, '') : '');
        const label = r.label ?? r.title ?? '';
        if (!code || !label) return null;
        return {
          code: String(code),
          label: String(label),
          description: r.description ?? r.altLabels?.[0] ?? undefined,
          category: r.skillType ?? r.category ?? 'general',
          iscoLinks: r.iscoLinks ?? (r.iscoGroup ? [r.iscoGroup] : []),
          source: 'esco',
          uri: r.uri,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const result = await this.escoIngest.ingestRows(skills);
    return {
      persisted: result.inserted,
      note: `embedded ${result.embedded} into Milvus`,
    };
  }
}
