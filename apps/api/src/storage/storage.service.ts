import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { HarvestedDataset } from '../types/dataset.types';

/**
 * StorageService now plays a strictly diagnostic role: it archives every
 * harvested dataset as a pretty-printed JSON file under `data/` for human
 * inspection / debugging. Authoritative persistence happens in
 * PostgresLoader (numeric / time-series) and VectorLoader (ESCO + O*NET
 * embeddings).
 *
 * Each archive call writes:
 *   - `data/<sourceId>.json`      (latest snapshot, overwritten each run)
 *   - `data/<sourceId>/<runId>.json` (per-run, when a runId is supplied)
 *
 * The per-run path is what the LineageService deletes when an admin
 * removes a run.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly dataDir = path.join(process.cwd(), 'data');

  async onModuleInit() {
    await fs.ensureDir(this.dataDir);
    this.logger.log(`Diagnostic archive directory: ${this.dataDir}`);
  }

  /**
   * Persist the dataset as JSON. Returns the per-run archive path
   * (or the legacy "latest" path when no runId is provided) so callers
   * can record it on the dataset_runs row.
   */
  async archive(
    dataset: HarvestedDataset,
    runId?: string | null,
  ): Promise<string> {
    const latestPath = path.join(this.dataDir, `${dataset.sourceId}.json`);
    await fs.writeJson(latestPath, dataset, { spaces: 2 });

    if (runId) {
      const runDir = path.join(this.dataDir, dataset.sourceId);
      await fs.ensureDir(runDir);
      const runPath = path.join(runDir, `${runId}.json`);
      await fs.writeJson(runPath, dataset, { spaces: 2 });
      this.logger.log(
        `📦 Archived ${dataset.sourceId} run=${runId}: ${dataset.recordCount} records → ${runPath}`,
      );
      return runPath;
    }
    this.logger.log(
      `📦 Archived ${dataset.sourceId}: ${dataset.recordCount} records → ${latestPath}`,
    );
    return latestPath;
  }

  /** Backwards-compat alias for any caller still using `.save()`. */
  async save(dataset: HarvestedDataset): Promise<string> {
    return this.archive(dataset);
  }

  async load(sourceId: string): Promise<HarvestedDataset | null> {
    const filePath = path.join(this.dataDir, `${sourceId}.json`);
    if (!(await fs.pathExists(filePath))) return null;
    return fs.readJson(filePath);
  }

  async listAll(): Promise<
    { sourceId: string; lastFetched: string; recordCount: number }[]
  > {
    await fs.ensureDir(this.dataDir);
    const files = await fs.readdir(this.dataDir);
    const result: {
      sourceId: string;
      lastFetched: string;
      recordCount: number;
    }[] = [];
    for (const file of files.filter((f) => f.endsWith('.json'))) {
      try {
        const ds: HarvestedDataset = await fs.readJson(
          path.join(this.dataDir, file),
        );
        result.push({
          sourceId: ds.sourceId,
          lastFetched: ds.lastFetched,
          recordCount: ds.recordCount,
        });
      } catch {
        /* skip corrupt files */
      }
    }
    return result;
  }

  getDataDir(): string {
    return this.dataDir;
  }
}
