import type { HarvestedDataset } from '../types/dataset.types';

/**
 * A loader is a strategy for *persisting* a HarvestedDataset somewhere
 * useful (Postgres, Postgres+Milvus, JSON archive). Each harvester picks
 * the loader it wants in its constructor; the BaseHarvester just calls
 * `loader.load(dataset)` and doesn't care where the bytes go.
 *
 * Replaces the old "everything writes to a JSON file" StorageService.save()
 * model from Phase 1.
 */
export interface DatasetLoader {
  /** Diagnostic name surfaced in logs and /schedule output. */
  readonly name: string;

  /** Returns the number of rows actually persisted (post-validation). */
  load(dataset: HarvestedDataset): Promise<{ persisted: number; note?: string }>;
}
