import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DocumentChunkEntity } from './document-chunk.entity';
import {
  POLICY_REPORTS_COLLECTION,
  TRAINING_PROGRAMS_COLLECTION,
  type DocumentCorpus,
} from './corpora.collection';
import { MilvusVectorClient } from '../infra/vector/milvus.client';
import {
  EMBEDDER,
  type Embedder,
} from '../infra/embeddings/embedder.interface';

const COLLECTION_BY_CORPUS: Record<DocumentCorpus, string> = {
  policy_reports: POLICY_REPORTS_COLLECTION,
  training_programs: TRAINING_PROGRAMS_COLLECTION,
};

export interface CorpusVectorHit {
  chunk: DocumentChunkEntity;
  score: number;
}

/**
 * Semantic search over the policy_reports / training_programs corpora.
 * Mirrors EscoSearchService / OnetSearchService — embeds the query, hits
 * Milvus, joins back to the authoritative `document_chunks` rows.
 */
@Injectable()
export class CorporaSearchService {
  private readonly logger = new Logger(CorporaSearchService.name);

  constructor(
    @InjectRepository(DocumentChunkEntity)
    private readonly repo: Repository<DocumentChunkEntity>,
    private readonly milvus: MilvusVectorClient,
    @Inject(EMBEDDER) private readonly embedder: Embedder,
  ) {}

  async semanticSearch(
    corpus: DocumentCorpus,
    query: string,
    topK = 8,
  ): Promise<CorpusVectorHit[]> {
    const trimmed = (query ?? '').trim();
    if (!trimmed) return [];
    const collection = COLLECTION_BY_CORPUS[corpus];
    const [vector] = await this.embedder.embed([trimmed], 'query');
    const hits = await this.milvus.search(collection, vector, topK);
    if (hits.length === 0) return [];

    const lookup: Array<{
      id: string;
      documentId: string;
      chunkIndex: number;
      score: number;
    }> = [];
    for (const h of hits) {
      const idx = h.id.lastIndexOf(':');
      if (idx <= 0) continue;
      const documentId = h.id.slice(0, idx);
      const chunkIndex = Number(h.id.slice(idx + 1));
      if (!Number.isFinite(chunkIndex)) continue;
      lookup.push({ id: h.id, documentId, chunkIndex, score: h.score });
    }
    if (lookup.length === 0) return [];

    const chunks = await this.repo.find({
      where: {
        corpus,
        documentId: In(Array.from(new Set(lookup.map((l) => l.documentId)))),
        chunkIndex: In(Array.from(new Set(lookup.map((l) => l.chunkIndex)))),
      },
    });
    const byKey = new Map<string, DocumentChunkEntity>();
    for (const c of chunks) {
      byKey.set(`${c.documentId}:${c.chunkIndex}`, c);
    }
    return lookup
      .map((l) => {
        const chunk = byKey.get(`${l.documentId}:${l.chunkIndex}`);
        return chunk ? { chunk, score: l.score } : null;
      })
      .filter((x): x is CorpusVectorHit => x !== null);
  }
}
