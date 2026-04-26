import type { HarvestedDataset } from '../types/dataset.types';

/**
 * Loader = strategy for *persisting* a HarvestedDataset somewhere
 * useful (Postgres, Postgres+Milvus). Each harvester picks the loader
 * it wants in its constructor; the BaseHarvester just calls
 * `loader.load(dataset, ctx)` and doesn't care where the bytes go.
 *
 * The optional `ctx.runId` is propagated to every persisted row by the
 * loader so LineageService can cascade-delete a run later.
 */
export interface DatasetLoaderContext {
  runId?: string | null;
}

export interface DatasetLoader {
  /** Diagnostic name surfaced in logs and /schedule output. */
  readonly name: string;

  /** Returns the number of rows actually persisted (post-validation). */
  load(
    dataset: HarvestedDataset,
    ctx?: DatasetLoaderContext,
  ): Promise<DatasetLoaderResult>;
}

export interface DatasetLoaderResult {
  persisted: number;
  note?: string;
}
