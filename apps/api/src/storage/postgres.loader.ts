import { Injectable, Logger } from '@nestjs/common';
import { SignalsService } from '../signals/signals.service';
import { IscoService } from '../taxonomies/isco/isco.service';
import { CustomRecordsService } from './custom-records.service';
import type { DatasetLoader, DatasetLoaderContext } from './loader.types';
import type { HarvestedDataset } from '../types/dataset.types';

/**
 * Postgres strategy — for harvesters whose category is `labor`,
 * `automation`, `education`. Routes records into the right entity
 * based on `dataset.category` and (when needed) the `sourceId`.
 *
 * Every batch upsert is tagged with `ctx.runId` so LineageService can
 * cascade-delete a run later. Sources without a final entity emit a
 * TODO note (cron stays green) until Phase 3 fills in their loaders.
 */
@Injectable()
export class PostgresLoader implements DatasetLoader {
  readonly name = 'postgres';
  private readonly logger = new Logger(PostgresLoader.name);

  constructor(
    private readonly signals: SignalsService,
    private readonly isco: IscoService,
    private readonly customRecords: CustomRecordsService,
  ) {}

  async load(dataset: HarvestedDataset, ctx: DatasetLoaderContext = {}) {
    switch (dataset.sourceId) {
      case 'frey-osborne':
        return this.loadFreyOsborne(dataset, ctx);
      case 'wb-wdi':
      case 'wb-hci':
        return this.loadWbIndicator(dataset, ctx);
      case 'ilo-isco':
        return this.loadIsco(dataset, ctx);
      case 'ilo-ilostat':
        return this.loadIlostat(dataset, ctx);
      case 'un-population':
        return this.loadUnPopulation(dataset, ctx);
      case 'wittgenstein':
        return this.loadWittgenstein(dataset, ctx);
      case 'unesco-uis':
        return this.loadUnescoUis(dataset, ctx);
      case 'ilo-fow':
        return this.loadIloFow(dataset, ctx);
      case 'itu-digital':
        return this.loadItuDigital(dataset, ctx);
      case 'onet':
        return this.loadOnetTasks(dataset, ctx);
      default:
        return this.loadCustom(dataset, ctx);
    }
  }

  /**
   * Generic structured persistence for any admin-defined source whose slug
   * doesn't have a dedicated entity. Records are stored as JSONB on the
   * `custom_records` table, keyed by `(sourceSlug, recordKey?)` so repeat
   * uploads with a declared natural key upsert cleanly. The natural key
   * fields are read from `dataset.metadata.keyFields` (set by the admin
   * via UploadDialog → "Key columns") if present.
   */
  private async loadCustom(
    dataset: HarvestedDataset,
    ctx: DatasetLoaderContext,
  ) {
    const records = (dataset.records ?? []) as Record<string, unknown>[];
    if (records.length === 0) {
      return { persisted: 0, note: 'no records in upload payload' };
    }
    const meta = dataset.metadata ?? {};
    const keyFieldsRaw =
      (meta as Record<string, unknown>).keyFields ??
      (meta as Record<string, unknown>).naturalKey;
    const keyFields = Array.isArray(keyFieldsRaw)
      ? keyFieldsRaw.map(String)
      : typeof keyFieldsRaw === 'string'
        ? keyFieldsRaw.split(/[|,;\s]+/).filter((s) => s.length > 0)
        : undefined;
    const persisted = await this.customRecords.upsertMany(
      dataset.sourceId,
      records,
      { runId: ctx.runId, keyFields },
    );
    const note =
      keyFields && keyFields.length > 0
        ? `custom_records[${dataset.sourceId}] upserted ${persisted} rows (key=${keyFields.join('+')}).`
        : `custom_records[${dataset.sourceId}] inserted ${persisted} rows (no natural key).`;
    return { persisted, note };
  }

  private async loadFreyOsborne(
    dataset: HarvestedDataset,
    ctx: DatasetLoaderContext,
  ) {
    const rows = (dataset.records ?? [])
      .map((r: any) => {
        const iscoCode =
          r.iscoCode ?? r.isco_code ?? r.iscoMapping ?? r.socCode ?? '';
        const probability = Number(r.probability ?? r.automation_risk ?? 0);
        if (!iscoCode || Number.isNaN(probability)) return null;
        return {
          iscoCode: String(iscoCode),
          probability: Math.max(0, Math.min(1, probability)),
          source: 'frey-osborne',
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const persisted = await this.signals.upsertFreyOsborne(rows, ctx.runId);
    return { persisted };
  }

  private async loadWbIndicator(
    dataset: HarvestedDataset,
    ctx: DatasetLoaderContext,
  ) {
    const rows = (dataset.records ?? [])
      .map((r: any) => {
        const iso3 = r.countryCode ?? r.iso3 ?? r.country?.id ?? '';
        const indicator = r.indicatorId ?? r.indicator?.id ?? '';
        const year = Number(r.year ?? r.date);
        const value =
          r.value !== null && r.value !== undefined ? Number(r.value) : null;
        if (
          !iso3 ||
          !indicator ||
          !year ||
          value === null ||
          Number.isNaN(value)
        )
          return null;
        return {
          iso3: String(iso3),
          indicator: String(indicator),
          year,
          value,
          source: dataset.sourceId,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const persisted = await this.signals.upsertWbIndicatorPoints(
      rows,
      ctx.runId,
    );
    return { persisted };
  }

  private async loadIsco(
    dataset: HarvestedDataset,
    ctx: DatasetLoaderContext,
  ) {
    const rows = (dataset.records ?? [])
      .map((r: any) => {
        const code = String(r.code ?? r.iscoCode ?? '');
        const title = String(r.title ?? r.label ?? r.name ?? '');
        if (!code || !title) return null;
        return {
          code,
          title,
          skillLevel: r.skillLevel ?? null,
          sectorId: r.sectorId ?? null,
          source: 'ilo-isco',
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const persisted = await this.isco.upsertMany(rows, ctx.runId);
    return { persisted };
  }

  private async loadIlostat(
    dataset: HarvestedDataset,
    ctx: DatasetLoaderContext,
  ) {
    const rows = (dataset.records ?? [])
      .map((r: any) => {
        const refArea = String(r.refArea ?? r.ref_area ?? '').trim();
        const indicatorId = String(r.indicatorId ?? r.indicator_id ?? '').trim();
        const time = String(r.time ?? '').trim();
        if (!refArea || !indicatorId || !time) return null;
        const rawValue =
          r.obs_value ?? r.value ?? r.obsValue ?? null;
        const value =
          rawValue === null || rawValue === undefined ? null : Number(rawValue);
        return {
          refArea,
          indicatorId,
          indicatorName: r.indicatorName ?? r.indicator_name ?? null,
          sex: String(r.sex ?? ''),
          classif1: String(r.classif1 ?? ''),
          time,
          year: null,
          value: Number.isFinite(value as number) ? (value as number) : null,
          obsStatus: r.obs_status ?? r.obsStatus ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const persisted = await this.signals.upsertIlostatPoints(rows, ctx.runId);
    return { persisted };
  }

  private async loadUnPopulation(
    dataset: HarvestedDataset,
    ctx: DatasetLoaderContext,
  ) {
    const rows = (dataset.records ?? [])
      .map((r: any) => {
        const iso3 = String(
          r.iso3 ?? r.locationIso3 ?? r.location?.iso3 ?? r.locationName ?? '',
        ).trim();
        const indicator = String(r.indicator ?? r.indicatorId ?? '').trim();
        const year = Number(r.year ?? r.timeMid);
        if (!iso3 || !indicator || !year || Number.isNaN(year)) return null;
        const rawValue = r.value ?? null;
        const value =
          rawValue === null || rawValue === undefined ? null : Number(rawValue);
        return {
          iso3,
          indicator,
          indicatorName: r.indicatorName ?? null,
          sex: String(r.sex ?? ''),
          ageGroup: String(r.ageLabel ?? r.ageGroup ?? ''),
          year,
          value: Number.isFinite(value as number) ? (value as number) : null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const persisted = await this.signals.upsertUnPopulation(rows, ctx.runId);
    return { persisted };
  }

  private async loadWittgenstein(
    dataset: HarvestedDataset,
    ctx: DatasetLoaderContext,
  ) {
    const rows = (dataset.records ?? [])
      .map((r: any) => {
        const iso3 = String(r.iso3 ?? r.country_code ?? '').trim();
        const year = Number(r.year ?? r.period);
        if (!iso3 || !year || Number.isNaN(year)) return null;
        const rawPop = r.population ?? r.pop ?? null;
        const population =
          rawPop === null || rawPop === undefined ? null : Number(rawPop);
        return {
          iso3,
          year,
          scenario: String(r.scenario ?? r.ssp ?? ''),
          educLevel: String(r.educLevel ?? r.educ ?? r.education ?? ''),
          sex: String(r.sex ?? ''),
          ageGroup: String(r.agGroup ?? r.ageGroup ?? r.age ?? ''),
          population: Number.isFinite(population as number)
            ? (population as number)
            : null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const persisted = await this.signals.upsertWittgenstein(rows, ctx.runId);
    return { persisted };
  }

  private async loadUnescoUis(
    dataset: HarvestedDataset,
    ctx: DatasetLoaderContext,
  ) {
    const rows = (dataset.records ?? [])
      .map((r: any) => {
        const iso3 = String(r.countryCode ?? r.iso3 ?? '').trim();
        const indicator = String(r.indicatorId ?? r.indicator ?? '').trim();
        const year = Number(r.year);
        if (!iso3 || !indicator || !year || Number.isNaN(year)) return null;
        const rawValue = r.value ?? null;
        const value =
          rawValue === null || rawValue === undefined ? null : Number(rawValue);
        return {
          iso3,
          indicator,
          indicatorName: r.indicatorName ?? null,
          year,
          value: Number.isFinite(value as number) ? (value as number) : null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const persisted = await this.signals.upsertUnescoUis(rows, ctx.runId);
    return { persisted };
  }

  private async loadIloFow(
    dataset: HarvestedDataset,
    ctx: DatasetLoaderContext,
  ) {
    // ILO FoW returns indicator-level rows (refArea + indicator + time). We
    // store them as task-index entries keyed by the ISCO code when present
    // (some indicators ship a `classif1` ISCO breakdown), otherwise we use
    // the refArea as a country-level proxy so the rows are still queryable.
    const rows = (dataset.records ?? [])
      .map((r: any) => {
        const indicatorId = String(r.indicatorId ?? '').trim();
        if (!indicatorId) return null;
        const time = String(r.time ?? '').trim();
        const yearMatch = time.match(/^(\d{4})/);
        const year = yearMatch ? Number(yearMatch[1]) : null;
        const rawValue = r.obs_value ?? r.value ?? null;
        const value =
          rawValue === null || rawValue === undefined ? null : Number(rawValue);
        const refArea = String(r.refArea ?? '').trim();
        const iscoCode =
          String(r.iscoCode ?? r.classif1 ?? '').trim() || refArea || 'GLOBAL';
        return {
          iscoCode,
          metric: indicatorId,
          year,
          value: Number.isFinite(value as number) ? (value as number) : null,
          note: r.indicatorName ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const persisted = await this.signals.upsertIloFow(rows, ctx.runId);
    return { persisted };
  }

  private async loadItuDigital(
    dataset: HarvestedDataset,
    ctx: DatasetLoaderContext,
  ) {
    const rows = (dataset.records ?? [])
      .map((r: any) => {
        const iso3 = String(r.countryCode ?? r.iso3 ?? '').trim();
        const indicator = String(r.indicatorId ?? r.indicator ?? '').trim();
        const year = Number(r.year);
        if (!iso3 || !indicator || !year || Number.isNaN(year)) return null;
        const rawValue = r.value ?? null;
        const value =
          rawValue === null || rawValue === undefined ? null : Number(rawValue);
        return {
          iso3,
          indicator,
          indicatorName: r.indicatorName ?? null,
          year,
          value: Number.isFinite(value as number) ? (value as number) : null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const persisted = await this.signals.upsertItuDigital(rows, ctx.runId);
    return { persisted };
  }

  private async loadOnetTasks(
    dataset: HarvestedDataset,
    ctx: DatasetLoaderContext,
  ) {
    // O*NET task statements: structured rows are upserted to Postgres here;
    // the VectorLoader branch handles the embedding into Milvus separately.
    const rows = (dataset.records ?? [])
      .map((r: any) => {
        const onetCode = String(r.onetCode ?? r['O*NET-SOC Code'] ?? '').trim();
        const taskId = String(r.taskId ?? r['Task ID'] ?? '').trim();
        const statement = String(r.statement ?? r['Task'] ?? '').trim();
        if (!onetCode || !taskId || !statement) return null;
        const importance =
          r.importance === undefined || r.importance === null
            ? null
            : Number(r.importance);
        const level =
          r.level === undefined || r.level === null ? null : Number(r.level);
        return {
          onetCode,
          taskId,
          statement,
          importance: Number.isFinite(importance as number)
            ? (importance as number)
            : null,
          level: Number.isFinite(level as number) ? (level as number) : null,
          taskType: String(r.taskType ?? r['Task Type'] ?? ''),
          iscoCode: r.iscoCode ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const persisted = await this.signals.upsertOnetTasks(rows, ctx.runId);
    return { persisted };
  }
}
