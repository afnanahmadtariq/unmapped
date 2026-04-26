import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../storage/storage.service';
import { VectorLoader } from '../../storage/vector.loader';
import { BaseHarvester } from '../base.harvester';

/**
 * O*NET Task Statements (US Department of Labor).
 *
 * The O*NET database is published as a versioned bundle of tab-separated
 * text files at `https://www.onetcenter.org/dl_files/database/`. The
 * version number bumps every six months (e.g. `db_28_2_text`,
 * `db_29_0_text`). We pin the latest known release here and let the
 * harvester fall back through a small list of recent releases if a
 * particular URL has rotated.
 *
 * The Task Statements file (`Task Statements.txt`) is a clean tab-
 * separated table with columns:
 *   O*NET-SOC Code | Task ID | Task | Task Type | ...
 *
 * We embed the `Task` column into the `onet_tasks` Milvus collection so
 * the RAG retriever can do task-level matching alongside ESCO skills.
 */
@Injectable()
export class OnetHarvester extends BaseHarvester {
  get sourceId() {
    return 'onet';
  }
  get sourceName() {
    return 'O*NET Task Statements (US DOL)';
  }
  get sourceUrl() {
    return 'https://www.onetcenter.org/database.html';
  }
  get sourceCategory() {
    return 'skills';
  }
  get cronExpression() {
    return '0 6 1 1,7 *';
  } // Every 6 months — O*NET releases ~biannually

  // Try newest first; first one that 200s wins. The format of these URLs
  // has been stable for years; bumping a version is a one-line change.
  private readonly candidateBases = [
    'https://www.onetcenter.org/dl_files/database/db_28_2_text',
    'https://www.onetcenter.org/dl_files/database/db_28_1_text',
    'https://www.onetcenter.org/dl_files/database/db_28_0_text',
    'https://www.onetcenter.org/dl_files/database/db_27_3_text',
  ];

  constructor(storage: StorageService, loader: VectorLoader) {
    super(storage, loader);
  }

  @Cron('0 6 1 1,7 *')
  async harvest(): Promise<void> {
    this.logger.log('Harvesting O*NET task statements...');

    const tasks = await this.fetchTaskStatements();
    if (tasks.length === 0) {
      this.logger.warn('O*NET returned no task statements.');
      return;
    }

    // Optional: enrich with importance/level from Task Ratings if available.
    try {
      const ratings = await this.fetchTaskRatings();
      this.applyRatings(tasks, ratings);
    } catch (err) {
      this.logger.warn(
        `O*NET ratings enrichment skipped: ${(err as Error).message}`,
      );
    }

    await this.persist(
      this.makeDataset({
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        category: 'skills',
        metadata: {
          apiUrl: this.sourceUrl,
          totalTasks: tasks.length,
          note: 'O*NET task statements, embedded into the onet_tasks Milvus collection for RAG retrieval.',
        },
        records: tasks,
      }),
    );
  }

  private async fetchTaskStatements(): Promise<Record<string, any>[]> {
    for (const base of this.candidateBases) {
      const url = `${base}/Task%20Statements.txt`;
      try {
        const { data } = await this.http.get(url, {
          responseType: 'text',
          timeout: 60000,
        });
        const rows = this.parseTsv(data as string);
        if (rows.length > 0) {
          this.logger.log(`O*NET task statements fetched from ${url}`);
          return rows.map((r) => ({
            onetCode: r['O*NET-SOC Code'],
            taskId: r['Task ID'],
            statement: r['Task'],
            taskType: r['Task Type'] ?? '',
          }));
        }
      } catch (err: any) {
        this.logger.warn(`O*NET ${url} failed: ${err.message}`);
      }
    }
    return [];
  }

  private async fetchTaskRatings(): Promise<Record<string, any>[]> {
    for (const base of this.candidateBases) {
      const url = `${base}/Task%20Ratings.txt`;
      try {
        const { data } = await this.http.get(url, {
          responseType: 'text',
          timeout: 60000,
        });
        const rows = this.parseTsv(data as string);
        if (rows.length > 0) return rows;
      } catch {
        // try next base
      }
    }
    return [];
  }

  private applyRatings(
    tasks: Record<string, any>[],
    ratings: Record<string, any>[],
  ): void {
    if (ratings.length === 0) return;
    // Map (taskId -> {IM: importance, ...}) using the "Scale ID" column.
    const byTaskId = new Map<string, { importance?: number; level?: number }>();
    for (const r of ratings) {
      const taskId = String(r['Task ID'] ?? '').trim();
      if (!taskId) continue;
      const scale = String(r['Scale ID'] ?? '').trim();
      const value = parseFloat(r['Data Value']);
      if (Number.isNaN(value)) continue;
      const acc = byTaskId.get(taskId) ?? {};
      if (scale === 'IM') acc.importance = value;
      if (scale === 'RT' || scale === 'FT' || scale === 'LV') {
        acc.level = value;
      }
      byTaskId.set(taskId, acc);
    }
    for (const t of tasks) {
      const acc = byTaskId.get(String(t.taskId));
      if (!acc) continue;
      if (acc.importance !== undefined) t.importance = acc.importance;
      if (acc.level !== undefined) t.level = acc.level;
    }
  }

  /**
   * Tab-separated value parser. O*NET ships UTF-8 with CRLF line endings
   * and the Task header literally "O*NET-SOC Code\tTask ID\tTask\t...".
   * No values contain tabs, so a strict split is safe.
   */
  private parseTsv(text: string): Record<string, string>[] {
    const lines = String(text).split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length === 0) return [];
    const headers = lines[0].split('\t').map((h) => h.trim());
    const out: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      if (cols.length < 2) continue;
      const row: Record<string, string> = {};
      for (let c = 0; c < headers.length; c++) {
        row[headers[c]] = (cols[c] ?? '').trim();
      }
      out.push(row);
    }
    return out;
  }
}
