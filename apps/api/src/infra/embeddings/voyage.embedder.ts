import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { EnvService } from '../config/env.service';
import { Embedder } from './embedder.interface';

/**
 * Voyage AI embedder (Anthropic-recommended). Free tier covers a few million
 * tokens and the v3 family is competitive with OpenAI text-embedding-3.
 *
 * Docs: https://docs.voyageai.com/reference/embeddings-api
 *
 * Fail-soft contract: on any non-2xx response (401 missing key, 429 rate
 * limit, network error, timeout) we LOG and return []. Callers downstream
 * (RAG retrieval) treat an empty embedding array as "skip vector narrowing"
 * and fall back to the full-taxonomy candidate path. Skill extraction stays
 * functional even when Voyage is throttling or misconfigured.
 */
@Injectable()
export class VoyageEmbedder implements Embedder {
  private readonly logger = new Logger(VoyageEmbedder.name);
  private readonly http: AxiosInstance;
  private readonly hasApiKey: boolean;
  // Once Voyage tells us we're rate-limited or unauthorized, stop hammering
  // it for a short cool-off window. Keeps logs clean and saves the budget.
  private suspendedUntil = 0;
  readonly model: string;
  readonly dim: number;

  constructor(env: EnvService) {
    const apiKey = env.get('EMBEDDINGS_API_KEY');
    this.hasApiKey = !!apiKey;
    this.model = env.get('EMBEDDINGS_MODEL');
    this.dim = env.get('EMBEDDINGS_DIM');
    if (!this.hasApiKey) {
      this.logger.warn(
        'EMBEDDINGS_API_KEY not set - Voyage calls will be skipped. RAG falls back to no-vector candidate path.',
      );
    }
    this.http = axios.create({
      baseURL: 'https://api.voyageai.com/v1',
      timeout: 15000,
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
    if (!this.hasApiKey) return [];
    if (Date.now() < this.suspendedUntil) return [];

    try {
      const { data } = await this.http.post<{
        data: Array<{ embedding: number[] }>;
      }>('/embeddings', {
        input: texts,
        model: this.model,
        input_type: kind,
      });
      return data.data.map((d) => d.embedding);
    } catch (err) {
      const ax = err as AxiosError<{ detail?: string }>;
      const status = ax.response?.status;
      const detail = (ax.response?.data as { detail?: string } | undefined)?.detail;
      const msg = detail ?? ax.message ?? String(err);

      if (status === 429) {
        // Voyage free tier: short cool-off so we don't spam the same 429.
        this.suspendedUntil = Date.now() + 30_000;
        this.logger.warn(
          `Voyage rate-limited (429). Skipping vector path for 30s. ${msg}`,
        );
      } else if (status === 401 || status === 403) {
        this.suspendedUntil = Date.now() + 5 * 60_000;
        this.logger.warn(
          `Voyage auth failed (${status}). Skipping vector path for 5m. Check EMBEDDINGS_API_KEY. ${msg}`,
        );
      } else {
        this.logger.warn(
          `Voyage embed failed (${texts.length} texts, kind=${kind}, status=${status ?? 'network'}): ${msg}. Falling back to no-vector path.`,
        );
      }
      return [];
    }
  }
}
