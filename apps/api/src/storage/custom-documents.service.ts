import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentChunkEntity } from '../corpora/document-chunk.entity';
import { MilvusVectorClient } from '../infra/vector/milvus.client';
import {
  EMBEDDER,
  type Embedder,
} from '../infra/embeddings/embedder.interface';

export interface CustomDocumentInput {
  documentId: string;
  title?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

const COLLECTION_PREFIX = 'cartographer_custom_';
const COLLECTION_MAX_LEN = 64;
const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 200;
const BATCH_SIZE = 32;

/**
 * Generic vector ingest for admin upload sources whose payload is text
 * (markdown, plain text, JSON/CSV with a `body` column). Each source slug
 * gets its own Milvus collection — `cartographer_custom_<sanitised-slug>` —
 * created on first use. The `document_chunks` Postgres table is reused
 * for chunk authority and cascade-deletion (it already has a `corpus`
 * column we can repurpose by storing the slug there).
 */
@Injectable()
export class CustomDocumentsService {
  private readonly logger = new Logger(CustomDocumentsService.name);
  private readonly ensured = new Set<string>();

  constructor(
    @InjectRepository(DocumentChunkEntity)
    private readonly chunkRepo: Repository<DocumentChunkEntity>,
    private readonly milvus: MilvusVectorClient,
    @Inject(EMBEDDER) private readonly embedder: Embedder,
  ) {}

  collectionFor(slug: string): string {
    const sanitised = slug
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `${COLLECTION_PREFIX}${sanitised}`.slice(0, COLLECTION_MAX_LEN);
  }

  async ingest(
    sourceSlug: string,
    docs: CustomDocumentInput[],
    opts: { runId?: string | null; skipEmbed?: boolean } = {},
  ): Promise<{ documents: number; chunks: number; embedded: number }> {
    if (docs.length === 0) return { documents: 0, chunks: 0, embedded: 0 };

    const collection = this.collectionFor(sourceSlug);
    if (!this.ensured.has(collection)) {
      try {
        await this.milvus.ensureCollection(collection, this.embedder.dim);
        this.ensured.add(collection);
      } catch (err) {
        this.logger.warn(
          `Milvus ensureCollection(${collection}) failed: ${(err as Error).message}. ` +
            `Embeddings will be skipped — Postgres rows still persist for this run.`,
        );
      }
    }

    let totalChunks = 0;
    const allEntities: DocumentChunkEntity[] = [];
    for (const doc of docs) {
      const slices = this.chunkText(doc.body ?? '');
      slices.forEach((text, idx) => {
        const ent = this.chunkRepo.create({
          corpus: sourceSlug,
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

    await this.chunkRepo.upsert(
      allEntities as unknown as Parameters<typeof this.chunkRepo.upsert>[0],
      { conflictPaths: ['corpus', 'documentId', 'chunkIndex'] },
    );

    let embedded = 0;
    if (!opts.skipEmbed && this.ensured.has(collection)) {
      embedded = await this.embedAndUpsert(
        collection,
        sourceSlug,
        allEntities,
        opts.runId ?? null,
      );
    }

    this.logger.log(
      `custom_documents[${sourceSlug}]: ${docs.length} docs / ${totalChunks} chunks, embedded ${embedded}.`,
    );
    return { documents: docs.length, chunks: totalChunks, embedded };
  }

  private chunkText(text: string): string[] {
    const cleaned = (text ?? '').replace(/\r\n/g, '\n').trim();
    if (cleaned.length === 0) return [];
    if (cleaned.length <= CHUNK_SIZE) return [cleaned];
    const out: string[] = [];
    let start = 0;
    while (start < cleaned.length) {
      const end = Math.min(cleaned.length, start + CHUNK_SIZE);
      let cut = end;
      if (end < cleaned.length) {
        const lastBreak = cleaned.lastIndexOf('\n', end);
        if (lastBreak > start + CHUNK_SIZE * 0.5) cut = lastBreak;
        else {
          const lastSentence = Math.max(
            cleaned.lastIndexOf('. ', end),
            cleaned.lastIndexOf('? ', end),
            cleaned.lastIndexOf('! ', end),
          );
          if (lastSentence > start + CHUNK_SIZE * 0.5) cut = lastSentence + 1;
        }
      }
      out.push(cleaned.slice(start, cut).trim());
      if (cut >= cleaned.length) break;
      start = Math.max(cut - CHUNK_OVERLAP, start + 1);
    }
    return out.filter((s) => s.length > 0);
  }

  private async embedAndUpsert(
    collection: string,
    sourceSlug: string,
    rows: DocumentChunkEntity[],
    runId: string | null,
  ): Promise<number> {
    let embedded = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
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
            corpus: sourceSlug,
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
