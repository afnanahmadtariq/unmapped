import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { EnvService } from '../config/env.service';
import { Embedder } from './embedder.interface';

/**
 * Voyage AI embedder (Anthropic-recommended). Free tier covers a few million
 * tokens and the v3 family is competitive with OpenAI text-embedding-3.
 *
 * Docs: https://docs.voyageai.com/reference/embeddings-api
 */
@Injectable()
export class VoyageEmbedder implements Embedder {
  private readonly logger = new Logger(VoyageEmbedder.name);
  private readonly http: AxiosInstance;
  readonly model: string;
  readonly dim: number;

  constructor(env: EnvService) {
    const apiKey = env.get('EMBEDDINGS_API_KEY');
    this.model = env.get('EMBEDDINGS_MODEL');
    this.dim = env.get('EMBEDDINGS_DIM');
    this.http = axios.create({
      baseURL: 'https://api.voyageai.com/v1',
      timeout: 30000,
      headers: apiKey
        ? {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          }
        : { 'Content-Type': 'application/json' },
    });
  }

  async embed(
    texts: string[],
    kind: 'document' | 'query',
  ): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const { data } = await this.http.post<{
        data: Array<{ embedding: number[] }>;
      }>('/embeddings', {
        input: texts,
        model: this.model,
        input_type: kind,
      });
      return data.data.map((d) => d.embedding);
    } catch (err: any) {
      this.logger.error(
        `Voyage embed failed (${texts.length} texts, kind=${kind}): ${
          err?.message ?? err
        }`,
      );
      throw err;
    }
  }
}
