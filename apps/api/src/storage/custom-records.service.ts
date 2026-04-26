import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomRecordEntity } from './custom-record.entity';

export interface CustomRecordWriteOptions {
  /** Field name(s) on the record that act as the natural key. Concatenated
   *  with `|` to form `recordKey`. Repeated uploads with the same key + slug
   *  will replace the previous record (upsert). */
  keyFields?: string[];
  runId?: string | null;
}

/**
 * Generic structured-record persistence for admin-defined sources.
 * Used by `PostgresLoader` whenever the upload's `sourceId` doesn't match
 * a hard-wired entity (Frey-Osborne, ILOSTAT, …).
 */
@Injectable()
export class CustomRecordsService {
  private readonly logger = new Logger(CustomRecordsService.name);

  constructor(
    @InjectRepository(CustomRecordEntity)
    private readonly repo: Repository<CustomRecordEntity>,
  ) {}

  async upsertMany(
    sourceSlug: string,
    records: Record<string, unknown>[],
    opts: CustomRecordWriteOptions = {},
  ): Promise<number> {
    if (records.length === 0) return 0;

    const rows = records.map((rec) => {
      const recordKey = this.computeKey(rec, opts.keyFields);
      return {
        sourceSlug,
        recordKey,
        record: rec,
        runId: opts.runId ?? null,
      };
    });

    // When a key is declared, prefer upsert — same (slug, key) replaces the
    // previous record. Without a key we just insert (every upload becomes
    // additive history, deletion via runId still works).
    const hasKey = rows.every((r) => r.recordKey !== null);
    if (hasKey) {
      await this.repo.upsert(
        rows as unknown as Parameters<typeof this.repo.upsert>[0],
        {
          conflictPaths: ['sourceSlug', 'recordKey'],
        },
      );
    } else {
      await this.repo.save(rows.map((r) => this.repo.create(r)), {
        chunk: 500,
      });
    }

    this.logger.log(
      `custom_records[${sourceSlug}]: persisted ${rows.length} records (upsert=${hasKey}).`,
    );
    return rows.length;
  }

  async findBySource(
    sourceSlug: string,
    limit = 100,
  ): Promise<CustomRecordEntity[]> {
    return this.repo.find({
      where: { sourceSlug },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 1000),
    });
  }

  async deleteByRun(runId: string): Promise<number> {
    const result = await this.repo.delete({ runId });
    return result.affected ?? 0;
  }

  async deleteBySource(sourceSlug: string): Promise<number> {
    const result = await this.repo.delete({ sourceSlug });
    return result.affected ?? 0;
  }

  private computeKey(
    record: Record<string, unknown>,
    keyFields?: string[],
  ): string | null {
    if (!keyFields || keyFields.length === 0) return null;
    const parts: string[] = [];
    for (const field of keyFields) {
      const value = record[field];
      if (value === null || value === undefined || value === '') return null;
      parts.push(String(value));
    }
    return parts.join('|').slice(0, 255);
  }
}
