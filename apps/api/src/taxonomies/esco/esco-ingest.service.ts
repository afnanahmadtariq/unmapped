import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import escoSeed from './data/esco-skills.seed.json';
import { EscoSkillEntity } from './esco.entity';
import { ESCO_VECTOR_COLLECTION } from './esco.collection';
import { MilvusVectorClient } from '../../infra/vector/milvus.client';
import {
  EMBEDDER,
  type Embedder,
} from '../../infra/embeddings/embedder.interface';

interface SeedSkill {
  code: string;
  label: string;
  category: string;
  iscoLinks: string[];
  description?: string;
}

/**
 * Ingests ESCO skill rows into Postgres AND embeds their text into Milvus.
 *
 * On boot it seeds the bundled `esco-skills.seed.json` if Postgres is empty,
 * so the rest of the system (RAG retrieval, profile extraction, matching)
 * has a working corpus from minute zero. The cron-triggered ESCO harvester
 * (apps/api/src/harvest/harvesters/esco.harvester.ts) calls `ingestRows` to
 * keep the table fresh against the live ESCO REST API.
 */
@Injectable()
export class EscoIngestService implements OnModuleInit {
  private readonly logger = new Logger(EscoIngestService.name);
  private readonly batchSize = 64;

  constructor(
    @InjectRepository(EscoSkillEntity)
    private readonly repo: Repository<EscoSkillEntity>,
    private readonly milvus: MilvusVectorClient,
    @Inject(EMBEDDER) private readonly embedder: Embedder,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.milvus.ensureCollection(
        ESCO_VECTOR_COLLECTION,
        this.embedder.dim,
      );
    } catch (err) {
      this.logger.warn(
        `Milvus collection bootstrap failed: ${(err as Error).message}. ` +
          `RAG retrieval will be unavailable until the vector store is reachable.`,
      );
      return;
    }
    try {
      const count = await this.repo.count();
      if (count === 0) {
        this.logger.log('ESCO table empty — seeding from bundled snapshot.');
        await this.ingestRows(
          (escoSeed as { skills: SeedSkill[] }).skills.map((s) => ({
            ...s,
            source: 'snapshot',
          })),
          { skipEmbed: false },
        );
      } else {
        this.logger.log(`ESCO table populated (${count} rows). Skipping seed.`);
      }
    } catch (err) {
      this.logger.warn(
        `ESCO seed skipped: ${(err as Error).message}. ` +
          `Run with TYPEORM_SYNC=true (dev) or apply migrations (prod).`,
      );
    }
  }

  /**
   * Upsert rows into Postgres and (unless skipEmbed) embed them into Milvus.
   * `code` is the primary key; descriptions fall back to label when missing.
   */
  async ingestRows(
    rows: Array<{
      code: string;
      label: string;
      category?: string;
      iscoLinks?: string[];
      description?: string;
      source?: string;
      uri?: string;
    }>,
    opts: { skipEmbed?: boolean; runId?: string | null } = {},
  ): Promise<{ inserted: number; embedded: number }> {
    if (rows.length === 0) return { inserted: 0, embedded: 0 };

    const entities = rows.map((r) =>
      this.repo.create({
        code: r.code,
        label: r.label,
        description: r.description ?? null,
        category: r.category ?? 'general',
        iscoLinks: r.iscoLinks ?? [],
        source: r.source ?? 'snapshot',
        uri: r.uri ?? null,
        embedded: false,
        runId: opts.runId ?? null,
        updatedAt: new Date(),
      }),
    );

    await this.repo.upsert(entities, { conflictPaths: ['code'] });

    let embedded = 0;
    if (!opts.skipEmbed) {
      embedded = await this.embedAndUpsertMilvus(entities, opts.runId ?? null);
    }

    this.logger.log(
      `ESCO ingest: upserted ${entities.length} rows, embedded ${embedded}`,
    );
    return { inserted: entities.length, embedded };
  }

  private async embedAndUpsertMilvus(
    rows: EscoSkillEntity[],
    runId: string | null,
  ): Promise<number> {
    let embedded = 0;
    for (let i = 0; i < rows.length; i += this.batchSize) {
      const batch = rows.slice(i, i + this.batchSize);
      const texts = batch.map((r) =>
        [r.label, r.description, r.category].filter(Boolean).join('. '),
      );
      const vectors = await this.embedder.embed(texts, 'document');
      await this.milvus.upsert(
        ESCO_VECTOR_COLLECTION,
        batch.map((r, idx) => ({
          id: r.code,
          vector: vectors[idx],
          metadata: {
            label: r.label,
            category: r.category,
            ...(runId ? { run_id: runId } : {}),
          },
        })),
      );
      await this.repo.update(
        batch.map((r) => r.code),
        { embedded: true },
      );
      embedded += batch.length;
    }
    return embedded;
  }

  /** Force a re-embed of every Postgres row. Useful after model upgrades. */
  async reembedAll(): Promise<{ embedded: number }> {
    const rows = await this.repo.find();
    const embedded = await this.embedAndUpsertMilvus(rows, null);
    return { embedded };
  }
}
