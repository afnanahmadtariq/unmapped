import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnetTaskEntity } from './entities/onet-task.entity';
import { ONET_VECTOR_COLLECTION } from './onet.collection';
import { MilvusVectorClient } from '../infra/vector/milvus.client';
import {
  EMBEDDER,
  type Embedder,
} from '../infra/embeddings/embedder.interface';

export interface OnetTaskRow {
  onetCode: string;
  taskId: string;
  statement: string;
  importance?: number | null;
  level?: number | null;
  taskType?: string;
  iscoCode?: string | null;
  source?: string;
}

/**
 * Ingests O*NET task statements into Postgres AND embeds the statement text
 * into the `onet_tasks` Milvus collection. The Milvus primary key is
 * `<onetCode>:<taskId>` so cascade deletion can fan out by id list — the
 * same pattern as ESCO uses with skill `code`.
 */
@Injectable()
export class OnetIngestService implements OnModuleInit {
  private readonly logger = new Logger(OnetIngestService.name);
  private readonly batchSize = 64;

  constructor(
    @InjectRepository(OnetTaskEntity)
    private readonly repo: Repository<OnetTaskEntity>,
    private readonly milvus: MilvusVectorClient,
    @Inject(EMBEDDER) private readonly embedder: Embedder,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.milvus.ensureCollection(
        ONET_VECTOR_COLLECTION,
        this.embedder.dim,
      );
    } catch (err) {
      this.logger.warn(
        `Milvus collection bootstrap failed: ${(err as Error).message}. ` +
          `O*NET retrieval will be unavailable until the vector store is reachable.`,
      );
    }
  }

  async ingestRows(
    rows: OnetTaskRow[],
    opts: { skipEmbed?: boolean; runId?: string | null } = {},
  ): Promise<{ inserted: number; embedded: number }> {
    if (rows.length === 0) return { inserted: 0, embedded: 0 };

    const entities = rows.map((r) =>
      this.repo.create({
        onetCode: r.onetCode,
        taskId: r.taskId,
        statement: r.statement,
        importance:
          r.importance === null || r.importance === undefined
            ? null
            : r.importance.toFixed(2),
        level:
          r.level === null || r.level === undefined ? null : r.level.toFixed(2),
        taskType: r.taskType ?? '',
        iscoCode: r.iscoCode ?? null,
        runId: opts.runId ?? null,
        updatedAt: new Date(),
      }),
    );

    await this.repo.upsert(entities, {
      conflictPaths: ['onetCode', 'taskId'],
    });

    let embedded = 0;
    if (!opts.skipEmbed) {
      embedded = await this.embedAndUpsertMilvus(entities, opts.runId ?? null);
    }

    this.logger.log(
      `O*NET ingest: upserted ${entities.length} rows, embedded ${embedded}`,
    );
    return { inserted: entities.length, embedded };
  }

  private async embedAndUpsertMilvus(
    rows: OnetTaskEntity[],
    runId: string | null,
  ): Promise<number> {
    let embedded = 0;
    for (let i = 0; i < rows.length; i += this.batchSize) {
      const batch = rows.slice(i, i + this.batchSize);
      const texts = batch.map((r) => r.statement);
      const vectors = await this.embedder.embed(texts, 'document');
      await this.milvus.upsert(
        ONET_VECTOR_COLLECTION,
        batch.map((r, idx) => ({
          id: `${r.onetCode}:${r.taskId}`,
          vector: vectors[idx],
          metadata: {
            onet_code: r.onetCode,
            task_id: r.taskId,
            task_type: r.taskType,
            ...(r.iscoCode ? { isco_code: r.iscoCode } : {}),
            ...(runId ? { run_id: runId } : {}),
          },
        })),
      );
      embedded += batch.length;
    }
    return embedded;
  }
}
