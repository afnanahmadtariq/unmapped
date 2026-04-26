import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  DataType,
  MilvusClient,
  MetricType,
  IndexType,
} from '@zilliz/milvus2-sdk-node';
import { EnvService } from '../config/env.service';

export interface VectorRecord {
  id: string;
  vector: number[];
  metadata?: Record<string, string | number | boolean>;
}

export interface VectorSearchHit {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Thin wrapper over @zilliz/milvus2-sdk-node. Centralises connection,
 * collection bootstrap, upsert and ANN search so the rest of the codebase
 * stays free of vendor SDK noise.
 */
@Injectable()
export class MilvusVectorClient implements OnModuleInit {
  private readonly logger = new Logger(MilvusVectorClient.name);
  private client!: MilvusClient;
  private readonly database: string;

  constructor(private readonly env: EnvService) {
    this.database = env.get('MILVUS_DATABASE');
  }

  async onModuleInit(): Promise<void> {
    this.client = new MilvusClient({
      address: this.env.get('MILVUS_URI'),
      token: this.env.get('MILVUS_TOKEN'),
      database: this.database,
    });
    this.logger.log(
      `Milvus connected: ${this.env.get('MILVUS_URI')} db=${this.database}`,
    );
  }

  raw(): MilvusClient {
    return this.client;
  }

  /**
   * Idempotently ensures a collection exists with the given vector dimension
   * and a HNSW index over its embedding column. Safe to call on every boot.
   */
  async ensureCollection(name: string, dim: number): Promise<void> {
    const has = await this.client.hasCollection({ collection_name: name });
    if (!has.value) {
      await this.client.createCollection({
        collection_name: name,
        fields: [
          {
            name: 'id',
            data_type: DataType.VarChar,
            is_primary_key: true,
            max_length: 128,
          },
          {
            name: 'embedding',
            data_type: DataType.FloatVector,
            dim,
          },
          {
            name: 'metadata',
            data_type: DataType.JSON,
          },
        ],
      });
      await this.client.createIndex({
        collection_name: name,
        field_name: 'embedding',
        index_type: IndexType.HNSW,
        metric_type: MetricType.COSINE,
        params: { M: 16, efConstruction: 200 },
      });
      this.logger.log(`Created Milvus collection ${name} (dim=${dim})`);
    }
    await this.client.loadCollectionSync({ collection_name: name });
  }

  async upsert(name: string, records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return;
    await this.client.upsert({
      collection_name: name,
      data: records.map((r) => ({
        id: r.id,
        embedding: r.vector,
        metadata: r.metadata ?? {},
      })),
    });
  }

  async search(
    name: string,
    queryVector: number[],
    topK: number,
  ): Promise<VectorSearchHit[]> {
    const result = await this.client.search({
      collection_name: name,
      data: [queryVector],
      limit: topK,
      output_fields: ['id', 'metadata'],
      params: { ef: 64 },
    });
    const rows = (result.results ?? []) as Array<{
      id: string;
      score: number;
      metadata?: Record<string, unknown>;
    }>;
    return rows.map((r) => ({ id: r.id, score: r.score, metadata: r.metadata }));
  }

  async dropCollection(name: string): Promise<void> {
    await this.client.dropCollection({ collection_name: name });
  }
}
