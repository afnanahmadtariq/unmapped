import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { HarvestedDataset } from '../types/dataset.types';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly dataDir = path.join(process.cwd(), 'data');

  async onModuleInit() {
    await fs.ensureDir(this.dataDir);
    this.logger.log(`Data directory: ${this.dataDir}`);
  }

  async save(dataset: HarvestedDataset): Promise<void> {
    const filePath = path.join(this.dataDir, `${dataset.sourceId}.json`);
    await fs.writeJson(filePath, dataset, { spaces: 2 });
    this.logger.log(`✅ Saved ${dataset.sourceId}: ${dataset.recordCount} records → ${filePath}`);
  }

  async load(sourceId: string): Promise<HarvestedDataset | null> {
    const filePath = path.join(this.dataDir, `${sourceId}.json`);
    if (!(await fs.pathExists(filePath))) return null;
    return fs.readJson(filePath);
  }

  async listAll(): Promise<{ sourceId: string; lastFetched: string; recordCount: number }[]> {
    await fs.ensureDir(this.dataDir);
    const files = await fs.readdir(this.dataDir);
    const result: { sourceId: string; lastFetched: string; recordCount: number }[] = [];
    for (const file of files.filter(f => f.endsWith('.json'))) {
      try {
        const ds: HarvestedDataset = await fs.readJson(path.join(this.dataDir, file));
        result.push({ sourceId: ds.sourceId, lastFetched: ds.lastFetched, recordCount: ds.recordCount });
      } catch { /* skip corrupt files */ }
    }
    return result;
  }

  async getDataDir(): Promise<string> {
    return this.dataDir;
  }
}
