import { Inject, Injectable } from '@nestjs/common';
import { EscoService } from './esco.service';
import { EscoSkillEntity } from './esco.entity';
import { ESCO_VECTOR_COLLECTION } from './esco.collection';
import { MilvusVectorClient } from '../../infra/vector/milvus.client';
import { EMBEDDER, type Embedder } from '../../infra/embeddings/embedder.interface';

export interface EscoVectorHit {
  skill: EscoSkillEntity;
  score: number;
}

/**
 * Vector search over the ESCO collection in Milvus, joined back to the
 * authoritative Postgres rows (so callers always get full label / category /
 * iscoLinks, not just a code).
 */
@Injectable()
export class EscoSearchService {
  constructor(
    private readonly esco: EscoService,
    private readonly milvus: MilvusVectorClient,
    @Inject(EMBEDDER) private readonly embedder: Embedder,
  ) {}

  async semanticSearch(query: string, topK = 12): Promise<EscoVectorHit[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const [vector] = await this.embedder.embed([trimmed], 'query');
    const hits = await this.milvus.search(ESCO_VECTOR_COLLECTION, vector, topK);
    if (hits.length === 0) return [];
    const skills = await this.esco.findManyByCodes(hits.map((h) => h.id));
    const byCode = new Map(skills.map((s) => [s.code, s]));
    return hits
      .map((h) => {
        const skill = byCode.get(h.id);
        return skill ? { skill, score: h.score } : null;
      })
      .filter((x): x is EscoVectorHit => x !== null);
  }
}
