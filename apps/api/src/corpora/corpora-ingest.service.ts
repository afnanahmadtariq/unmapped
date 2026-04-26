import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentChunkEntity } from './document-chunk.entity';
import {
  DOCUMENT_CORPORA,
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

export interface CorpusDocumentInput {
  /** Stable identifier for the source document (e.g. filename + checksum). */
  documentId: string;
  /** Human-readable title shown in retrieval previews. */
  title?: string;
  /** Full text body — will be sliced into ~512-token chunks. */
  body: string;
  /** Free-form metadata (publisher, year, country, region, …). */
  metadata?: Record<string, unknown>;
}

/**
 * Ingests long-form text documents (policy reports, training program
 * descriptions, …) into Postgres + Milvus.
 *
 * Flow per document:
 *   1. Slice `body` into ~512-token chunks with a small overlap.
 *   2. Upsert chunks into `document_chunks` (Postgres) keyed on
 *      `(corpus, documentId, chunkIndex)`.
 *   3. Embed chunk texts via the shared Embedder, then upsert into the
 *      corpus-specific Milvus collection with id `<documentId>:<idx>`
 *      and `run_id` metadata for cascade deletion.
 */
@Injectable()
export class CorporaIngestService implements OnModuleInit {
  private readonly logger = new Logger(CorporaIngestService.name);
  private readonly batchSize = 32;
  private readonly chunkSize = 1800;
  private readonly chunkOverlap = 200;

  constructor(
    @InjectRepository(DocumentChunkEntity)
    private readonly repo: Repository<DocumentChunkEntity>,
    private readonly milvus: MilvusVectorClient,
    @Inject(EMBEDDER) private readonly embedder: Embedder,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const corpus of DOCUMENT_CORPORA) {
      const collection = COLLECTION_BY_CORPUS[corpus];
      try {
        await this.milvus.ensureCollection(collection, this.embedder.dim);
      } catch (err) {
        this.logger.warn(
          `Milvus bootstrap failed for ${collection}: ${(err as Error).message}. ` +
            `${corpus} retrieval will be unavailable until the vector store is reachable.`,
        );
      }
    }
  }

  async ingestDocuments(
    corpus: DocumentCorpus,
    docs: CorpusDocumentInput[],
    opts: { runId?: string | null; skipEmbed?: boolean } = {},
  ): Promise<{
    documents: number;
    chunks: number;
    embedded: number;
  }> {
    if (docs.length === 0) return { documents: 0, chunks: 0, embedded: 0 };

    const collection = COLLECTION_BY_CORPUS[corpus];
    let totalChunks = 0;
    const allEntities: DocumentChunkEntity[] = [];
    for (const doc of docs) {
      const slices = this.chunkText(doc.body ?? '');
      slices.forEach((text, idx) => {
        const ent = this.repo.create({
          corpus,
          documentId: doc.documentId,
          chunkIndex: idx,
          title: doc.title ?? '',
          text,
          metadata: doc.metadata ?? null,
          runId: opts.runId ?? null,
          updatedAt: new Date(),
        });
        allEntities.push(ent);
      });
      totalChunks += slices.length;
    }

    if (allEntities.length === 0) {
      return { documents: docs.length, chunks: 0, embedded: 0 };
    }

    await this.repo.upsert(
      allEntities as unknown as Parameters<typeof this.repo.upsert>[0],
      { conflictPaths: ['corpus', 'documentId', 'chunkIndex'] },
    );

    let embedded = 0;
    if (!opts.skipEmbed) {
      embedded = await this.embedAndUpsert(
        collection,
        allEntities,
        opts.runId ?? null,
      );
    }

    this.logger.log(
      `Corpora ingest [${corpus}]: ${docs.length} docs / ${totalChunks} chunks, embedded ${embedded}.`,
    );
    return { documents: docs.length, chunks: totalChunks, embedded };
  }

  /**
   * Chunk plain text into roughly equal-length slices with overlap. We use
   * character counts as a fast proxy for token counts — accurate enough for
   * embedding quality and avoids the runtime cost of a real tokenizer.
   */
  private chunkText(text: string): string[] {
    const cleaned = (text ?? '').replace(/\r\n/g, '\n').trim();
    if (cleaned.length === 0) return [];
    if (cleaned.length <= this.chunkSize) return [cleaned];
    const out: string[] = [];
    let start = 0;
    while (start < cleaned.length) {
      const end = Math.min(cleaned.length, start + this.chunkSize);
      let cut = end;
      if (end < cleaned.length) {
        const lastBreak = cleaned.lastIndexOf('\n', end);
        if (lastBreak > start + this.chunkSize * 0.5) cut = lastBreak;
        else {
          const lastSentence = Math.max(
            cleaned.lastIndexOf('. ', end),
            cleaned.lastIndexOf('? ', end),
            cleaned.lastIndexOf('! ', end),
          );
          if (lastSentence > start + this.chunkSize * 0.5) cut = lastSentence + 1;
        }
      }
      out.push(cleaned.slice(start, cut).trim());
      if (cut >= cleaned.length) break;
      start = Math.max(cut - this.chunkOverlap, start + 1);
    }
    return out.filter((s) => s.length > 0);
  }

  private async embedAndUpsert(
    collection: string,
    rows: DocumentChunkEntity[],
    runId: string | null,
  ): Promise<number> {
    let embedded = 0;
    for (let i = 0; i < rows.length; i += this.batchSize) {
      const batch = rows.slice(i, i + this.batchSize);
      const texts = batch.map((r) =>
        [r.title, r.text].filter(Boolean).join('\n\n'),
      );
      const vectors = await this.embedder.embed(texts, 'document');
      await this.milvus.upsert(
        collection,
        batch.map((r, idx) => ({
          id: `${r.documentId}:${r.chunkIndex}`,
          vector: vectors[idx],
          metadata: {
            corpus: r.corpus,
            document_id: r.documentId,
            chunk_index: r.chunkIndex,
            ...(r.title ? { title: r.title } : {}),
            ...(runId ? { run_id: runId } : {}),
          },
        })),
      );
      embedded += batch.length;
    }
    return embedded;
  }
}
