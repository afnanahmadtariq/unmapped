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
 * It's the same on-disk format as before so existing manual harvest
 * inspections (`cat data/wb-wdi.json`) keep working during migration.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly dataDir = path.join(process.cwd(), 'data');

  async onModuleInit() {
    await fs.ensureDir(this.dataDir);
    this.logger.log(`Diagnostic archive directory: ${this.dataDir}`);
  }

  async archive(dataset: HarvestedDataset): Promise<void> {
    const filePath = path.join(this.dataDir, `${dataset.sourceId}.json`);
    await fs.writeJson(filePath, dataset, { spaces: 2 });
    this.logger.log(
      `📦 Archived ${dataset.sourceId}: ${dataset.recordCount} records → ${filePath}`,
    );
  }

  /** Backwards-compat alias for any caller still using `.save()`. */
  async save(dataset: HarvestedDataset): Promise<void> {
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
