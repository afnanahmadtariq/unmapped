import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { parse as csvParse } from 'csv-parse/sync';
import { z } from 'zod';
import { LineageService } from '../lineage/lineage.service';
import { StorageService } from '../storage/storage.service';
import { PostgresLoader } from '../storage/postgres.loader';
import { VectorLoader } from '../storage/vector.loader';
import type { DatasetLoader } from '../storage/loader.types';
import type { HarvestedDataset } from '../types/dataset.types';

/**
 * Handles admin file uploads as first-class lineage citizens.
 *
 * Flow:
 *   1. Look up the data_source by id.
 *   2. Parse the buffer (JSON, with NDJSON or array support).
 *   3. Validate against the source's `schemaSpec` (zod-shaped JSON).
 *   4. openRun(kind='upload') → load via Postgres/Vector loader → archive → closeRun.
 *
 * The loader pipeline is identical to the harvester path so deletion +
 * downstream signals work the same way.
 */
@Injectable()
export class AdminUploadService {
  private readonly logger = new Logger(AdminUploadService.name);

  constructor(
    private readonly lineage: LineageService,
    private readonly storage: StorageService,
    private readonly postgresLoader: PostgresLoader,
    private readonly vectorLoader: VectorLoader,
  ) {}

  async uploadToSource(
    sourceId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    overrides: {
      loader?: 'postgres' | 'vector';
      category?: string;
      keyFields?: string[];
    } = {},
  ): Promise<{
    runId: string;
    persisted: number;
    note?: string;
    format?: 'csv' | 'json' | 'ndjson' | 'text';
  }> {
    const source = await this.lineage.getSourceById(sourceId);
    if (!source) throw new NotFoundException(`Source ${sourceId} not found`);

    // Free-text path: any upload that lands in the vector loader (built-in
    // policy_reports / training_programs OR a custom source whose admin
    // explicitly picked loader=vector OR whose category is `rag-corpus`)
    // can accept .md / .txt / .pdf-converted plain text. Other sources fall
    // through to structured CSV / JSON parsing.
    const wantsVector =
      overrides.loader === 'vector' ||
      this.isBuiltInCorpus(source.slug) ||
      source.category === 'rag-corpus';

    const { records, format } = this.parseRecords(
      file.buffer,
      file.originalname,
      {
        allowFreeText: wantsVector,
      },
    );
    if (records.length === 0) {
      throw new BadRequestException('Upload contained zero records');
    }

    // Schema validation only for structured uploads. Vector / free-text
    // uploads carry {documentId, title, body} which the CorporaIngest /
    // CustomDocuments services enforce themselves.
    if (source.schemaSpec && !wantsVector) {
      const schema = this.buildZodFromSpec(source.schemaSpec);
      records.forEach((row, idx) => {
        // CSV gives us strings for everything → coerce to the schemaSpec
        // shape *before* validating so admins don't need to pre-process.
        const coerced =
          format === 'csv'
            ? this.coerceRecord(row, source.schemaSpec ?? {})
            : row;
        const result = schema.safeParse(coerced);
        if (!result.success) {
          throw new BadRequestException(
            `Row ${idx + 1} failed schema validation: ${result.error.issues
              .map((i) => `${i.path.join('.') || '(root)'} ${i.message}`)
              .join(', ')}`,
          );
        }
        // Mutate the record in-place so the loader sees the typed values.
        records[idx] = coerced;
      });
    } else if (format === 'csv' && source.schemaSpec) {
      // Even when validation is skipped (vector path), coerce CSV rows so
      // downstream metadata stays numeric where the spec says so.
      records.forEach((row, idx) => {
        records[idx] = this.coerceRecord(row, source.schemaSpec ?? {});
      });
    }

    const checksum = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    const { runId } = await this.lineage.openRun(source.slug, {
      kind: 'upload',
      filename: file.originalname,
      fileChecksum: checksum,
      ensureSource: {
        displayName: source.displayName,
        sourceUrl: source.sourceUrl,
        cron: source.cron,
        category: source.category,
        sourceKind: source.kind,
      },
    });

    const dataset: HarvestedDataset = {
      sourceId: source.slug,
      sourceName: source.displayName,
      category: overrides.category ?? source.category ?? 'manual',
      cronExpression: source.cron ?? 'manual-upload',
      lastFetched: new Date().toISOString(),
      nextScheduled: new Date().toISOString(),
      recordCount: records.length,
      fields: records.length > 0 ? Object.keys(records[0]) : [],
      records,
      metadata: {
        upload: true,
        filename: file.originalname,
        mimetype: file.mimetype,
        checksum,
        format,
        ...(overrides.keyFields && overrides.keyFields.length > 0
          ? { keyFields: overrides.keyFields }
          : {}),
      },
    };

    let persisted = 0;
    let note: string | undefined;
    let error: string | null = null;
    let archivePath: string | null = null;
    try {
      const loader = this.pickLoader(overrides.loader, source.slug, {
        category: source.category,
        wantsVector,
      });
      const result = await loader.load(dataset, { runId });
      persisted = result.persisted;
      note = result.note;
    } catch (err: any) {
      error = err?.message ?? 'unknown loader error';
    }

    try {
      archivePath = await this.storage.archive(dataset, runId);
    } catch (err) {
      this.logger.warn(
        `Archive failed for upload ${runId}: ${(err as Error).message}`,
      );
    }

    await this.lineage.closeRun(runId, {
      status: error ? 'failed' : 'ok',
      recordCount: persisted,
      error,
      archivePath,
    });

    if (error) throw new BadRequestException(`Upload persistence failed: ${error}`);
    return { runId, persisted, note, format };
  }

  /**
   * Best-effort parser. Format auto-detected from the filename:
   *   - `.csv`           → header row + columns. Trimmed, empty cells → null.
   *   - `.ndjson`        → one JSON record per line.
   *   - `.json`          → either a top-level array or `{records: [...]}`.
   *   - `.md` / `.txt`   → wrapped into a single `{documentId, title, body}`
   *                        record (only when `allowFreeText` is set).
   *
   * The chosen `format` is returned so the caller can decide whether to
   * coerce CSV string values against the source's schemaSpec.
   */
  private parseRecords(
    buffer: Buffer,
    filename: string,
    opts: { allowFreeText?: boolean } = {},
  ): { records: Record<string, unknown>[]; format: 'csv' | 'json' | 'ndjson' | 'text' } {
    const text = buffer.toString('utf-8').trim();
    if (text.length === 0) return { records: [], format: 'json' };

    const lower = filename.toLowerCase();

    if (lower.endsWith('.csv')) {
      let rows: Record<string, string>[];
      try {
        rows = csvParse(text, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          bom: true,
          relax_quotes: true,
        }) as Record<string, string>[];
      } catch (err) {
        throw new BadRequestException(
          `CSV parse error: ${(err as Error).message}`,
        );
      }
      const records = rows.map((r) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          out[k] = v === '' || v === undefined ? null : v;
        }
        return out;
      });
      return { records, format: 'csv' };
    }

    if (
      opts.allowFreeText &&
      (lower.endsWith('.md') ||
        lower.endsWith('.markdown') ||
        lower.endsWith('.txt'))
    ) {
      const baseName = filename.replace(/\.[^.]+$/, '');
      const firstLine = text.split(/\r?\n/, 1)[0]?.replace(/^#+\s*/, '').trim();
      return {
        records: [
          {
            documentId: baseName,
            title: firstLine && firstLine.length < 120 ? firstLine : baseName,
            body: text,
          },
        ],
        format: 'text',
      };
    }

    if (lower.endsWith('.ndjson')) {
      const records = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line, idx) => {
          try {
            return JSON.parse(line) as Record<string, unknown>;
          } catch {
            throw new BadRequestException(`NDJSON parse error on line ${idx + 1}`);
          }
        });
      return { records, format: 'ndjson' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BadRequestException(
        'Upload must be CSV, JSON, NDJSON, or .md/.txt (for vector sources). ' +
          `Could not parse "${filename}".`,
      );
    }
    if (Array.isArray(parsed)) {
      return {
        records: parsed as Record<string, unknown>[],
        format: 'json',
      };
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      'records' in (parsed as Record<string, unknown>) &&
      Array.isArray((parsed as Record<string, unknown>).records)
    ) {
      return {
        records: (parsed as { records: Record<string, unknown>[] }).records,
        format: 'json',
      };
    }
    throw new BadRequestException(
      'Upload JSON must be an array or an object with a "records" array.',
    );
  }

  /**
   * Coerce CSV string values into the types declared on `schemaSpec`.
   * Anything not described in the spec is passed through unchanged so the
   * record retains its raw shape for the loader.
   */
  private coerceRecord(
    row: Record<string, unknown>,
    spec: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...row };
    for (const [field, raw] of Object.entries(spec)) {
      const config = (raw && typeof raw === 'object' ? raw : { type: raw }) as {
        type?: string;
        optional?: boolean;
      };
      const cur = out[field];
      if (cur === null || cur === undefined || cur === '') {
        if (config.optional) out[field] = null;
        continue;
      }
      const str = String(cur);
      switch (config.type) {
        case 'number':
        case 'int': {
          const n = Number(str.replace(/,/g, ''));
          if (!Number.isFinite(n)) {
            throw new BadRequestException(
              `Field "${field}" expected number, got "${str}"`,
            );
          }
          out[field] = config.type === 'int' ? Math.trunc(n) : n;
          break;
        }
        case 'boolean': {
          const lower = str.toLowerCase().trim();
          if (['true', '1', 'yes', 'y'].includes(lower)) out[field] = true;
          else if (['false', '0', 'no', 'n'].includes(lower)) out[field] = false;
          else
            throw new BadRequestException(
              `Field "${field}" expected boolean, got "${str}"`,
            );
          break;
        }
        case 'string[]':
          out[field] = str
            .split(/[|;,]/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          break;
        case 'number[]':
          out[field] = str
            .split(/[|;,]/)
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n));
          break;
        case 'enum':
        case 'string':
        default:
          out[field] = str;
      }
    }
    return out;
  }

  private isBuiltInCorpus(slug: string): boolean {
    return slug === 'policy_reports' || slug === 'training_programs';
  }

  /**
   * Compile a zod schema from a stored JSON spec. Supported types:
   * `string`, `number`, `int`, `boolean`, `enum`, `string[]`, `number[]`.
   * Each field can carry `{ optional: true }`. Anything else is treated as
   * `z.unknown()` so admins can prototype loosely typed sources.
   */
  private buildZodFromSpec(
    spec: Record<string, unknown>,
  ): z.ZodType<Record<string, unknown>> {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [key, raw] of Object.entries(spec)) {
      const config = (raw && typeof raw === 'object' ? raw : { type: raw }) as {
        type?: string;
        optional?: boolean;
        values?: string[];
      };
      let field: z.ZodTypeAny;
      switch (config.type) {
        case 'string':
          field = z.string();
          break;
        case 'number':
          field = z.number();
          break;
        case 'int':
          field = z.number().int();
          break;
        case 'boolean':
          field = z.boolean();
          break;
        case 'enum':
          field = z.enum(((config.values as [string, ...string[]]) ?? ['']) as [
            string,
            ...string[],
          ]);
          break;
        case 'string[]':
          field = z.array(z.string());
          break;
        case 'number[]':
          field = z.array(z.number());
          break;
        default:
          field = z.unknown();
      }
      if (config.optional) field = field.optional().nullable();
      shape[key] = field;
    }
    return z.object(shape).passthrough();
  }

  private pickLoader(
    explicit: 'postgres' | 'vector' | undefined,
    slug: string,
    ctx: { category?: string | null; wantsVector?: boolean } = {},
  ): DatasetLoader {
    if (explicit === 'vector') return this.vectorLoader;
    if (explicit === 'postgres') return this.postgresLoader;
    if (ctx.wantsVector) return this.vectorLoader;
    const vectorSlugs = new Set([
      'esco',
      'onet',
      'policy_reports',
      'training_programs',
    ]);
    if (vectorSlugs.has(slug)) return this.vectorLoader;
    if (ctx.category === 'rag-corpus') return this.vectorLoader;
    return this.postgresLoader;
  }
}
