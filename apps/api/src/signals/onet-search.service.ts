import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OnetTaskEntity } from './entities/onet-task.entity';
import { ONET_VECTOR_COLLECTION } from './onet.collection';
import { MilvusVectorClient } from '../infra/vector/milvus.client';
import {
  EMBEDDER,
  type Embedder,
} from '../infra/embeddings/embedder.interface';

export interface OnetVectorHit {
  task: OnetTaskEntity;
  score: number;
}

/**
 * Vector search over the `onet_tasks` collection in Milvus, joined back to
 * the authoritative `onet_tasks` Postgres table. Mirrors `EscoSearchService`
 * so RetrievalService can fan out across both corpora and merge by score.
 */
@Injectable()
export class OnetSearchService {
  constructor(
    @InjectRepository(OnetTaskEntity)
    private readonly repo: Repository<OnetTaskEntity>,
    private readonly milvus: MilvusVectorClient,
    @Inject(EMBEDDER) private readonly embedder: Embedder,
  ) {}

  async semanticSearch(query: string, topK = 12): Promise<OnetVectorHit[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const [vector] = await this.embedder.embed([trimmed], 'query');
    const hits = await this.milvus.search(ONET_VECTOR_COLLECTION, vector, topK);
    if (hits.length === 0) return [];
    // Composite key in Milvus is `<onetCode>:<taskId>`; re-split to look up.
    const lookupPairs = hits
      .map((h) => {
        const idx = String(h.id).indexOf(':');
        if (idx <= 0) return null;
        return {
          id: String(h.id),
          onetCode: String(h.id).slice(0, idx),
          taskId: String(h.id).slice(idx + 1),
          score: h.score,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (lookupPairs.length === 0) return [];

    const taskIds = Array.from(new Set(lookupPairs.map((p) => p.taskId)));
    const codes = Array.from(new Set(lookupPairs.map((p) => p.onetCode)));
    const tasks = await this.repo.find({
      where: { onetCode: In(codes), taskId: In(taskIds) },
    });
    const byKey = new Map<string, OnetTaskEntity>();
    for (const t of tasks) {
      byKey.set(`${t.onetCode}:${t.taskId}`, t);
    }
    return lookupPairs
      .map((p) => {
        const task = byKey.get(p.id);
        return task ? { task, score: p.score } : null;
      })
      .filter((x): x is OnetVectorHit => x !== null);
  }
}
