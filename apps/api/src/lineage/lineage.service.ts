import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs-extra';
import { Repository } from 'typeorm';
import { DataSourceEntity } from './data-source.entity';
import {
  DatasetRunEntity,
  type DatasetRunKind,
  type DatasetRunStatus,
} from './dataset-run.entity';
import { WageEntity } from '../signals/entities/wage.entity';
import { SectorGrowthEntity } from '../signals/entities/sector-growth.entity';
import { FreyOsborneEntity } from '../signals/entities/frey-osborne.entity';
import { CountryCalibrationEntity } from '../signals/entities/country-calibration.entity';
import { WbIndicatorPointEntity } from '../signals/entities/wb-indicator.entity';
import { IlostatTimeSeriesEntity } from '../signals/entities/ilostat-time-series.entity';
import { WittgensteinProjectionEntity } from '../signals/entities/wittgenstein-projection.entity';
import { UnPopulationEntity } from '../signals/entities/un-population.entity';
import { UnescoUisEntity } from '../signals/entities/unesco-uis.entity';
import { IloFowTaskIndexEntity } from '../signals/entities/ilo-fow-task-index.entity';
import { ItuDigitalEntity } from '../signals/entities/itu-digital.entity';
import { OnetTaskEntity } from '../signals/entities/onet-task.entity';
import { EscoSkillEntity } from '../taxonomies/esco/esco.entity';
import { IscoOccupationEntity } from '../taxonomies/isco/isco.entity';
import { DocumentChunkEntity } from '../corpora/document-chunk.entity';
import { CustomRecordEntity } from '../storage/custom-record.entity';
import { MilvusVectorClient } from '../infra/vector/milvus.client';
import { ESCO_VECTOR_COLLECTION } from '../taxonomies/esco/esco.collection';
import { ONET_VECTOR_COLLECTION } from '../signals/onet.collection';
import {
  POLICY_REPORTS_COLLECTION,
  TRAINING_PROGRAMS_COLLECTION,
} from '../corpora/corpora.collection';

const KNOWN_CORPUS_COLLECTIONS: Record<string, string> = {
  policy_reports: POLICY_REPORTS_COLLECTION,
  training_programs: TRAINING_PROGRAMS_COLLECTION,
};

const CUSTOM_COLLECTION_PREFIX = 'unmapped_custom_';
const CUSTOM_COLLECTION_MAX_LEN = 64;

function customCollectionFor(slug: string): string {
  const sanitised = slug
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${CUSTOM_COLLECTION_PREFIX}${sanitised}`.slice(
    0,
    CUSTOM_COLLECTION_MAX_LEN,
  );
}

export interface OpenRunOptions {
  kind?: DatasetRunKind;
  filename?: string;
  fileChecksum?: string;
  ensureSource?: {
    displayName?: string;
    sourceUrl?: string | null;
    cron?: string | null;
    category?: string | null;
    sourceKind?: 'harvester' | 'upload';
  };
}

export interface CloseRunOptions {
  status: DatasetRunStatus;
  recordCount?: number;
  error?: string | null;
  archivePath?: string | null;
}

export interface DataSourceListItem {
  id: string;
  slug: string;
  displayName: string;
  kind: 'harvester' | 'upload';
  sourceUrl: string | null;
  cron: string | null;
  category: string | null;
  isActive: boolean;
  note: string | null;
  schemaSpec: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  lastRun: DatasetRunListItem | null;
  totalRuns: number;
}

export interface DatasetRunListItem {
  id: string;
  dataSourceId: string;
  sourceSlug: string;
  status: DatasetRunStatus;
  kind: DatasetRunKind;
  startedAt: string;
  finishedAt: string | null;
  recordCount: number;
  error: string | null;
  archivePath: string | null;
  fileChecksum: string | null;
  filename: string | null;
}

/**
 * Provenance hub. Owns `data_sources` + `dataset_runs`, opens and closes
 * runs, and — most importantly — performs cascade deletion across every
 * Postgres entity *and* the Milvus collections that derive from a run.
 *
 * Every harvester / upload pipeline calls `openRun()` before persisting and
 * `closeRun()` after, so the admin "delete this file's data and all its
 * derivatives" button is a one-line `lineage.deleteRun(runId)`.
 */
@Injectable()
export class LineageService {
  private readonly logger = new Logger(LineageService.name);

  constructor(
    @InjectRepository(DataSourceEntity)
    private readonly sourceRepo: Repository<DataSourceEntity>,
    @InjectRepository(DatasetRunEntity)
    private readonly runRepo: Repository<DatasetRunEntity>,
    @InjectRepository(WageEntity)
    private readonly wageRepo: Repository<WageEntity>,
    @InjectRepository(SectorGrowthEntity)
    private readonly growthRepo: Repository<SectorGrowthEntity>,
    @InjectRepository(FreyOsborneEntity)
    private readonly freyRepo: Repository<FreyOsborneEntity>,
    @InjectRepository(CountryCalibrationEntity)
    private readonly calRepo: Repository<CountryCalibrationEntity>,
    @InjectRepository(WbIndicatorPointEntity)
    private readonly wbRepo: Repository<WbIndicatorPointEntity>,
    @InjectRepository(IlostatTimeSeriesEntity)
    private readonly ilostatRepo: Repository<IlostatTimeSeriesEntity>,
    @InjectRepository(WittgensteinProjectionEntity)
    private readonly wcdeRepo: Repository<WittgensteinProjectionEntity>,
    @InjectRepository(UnPopulationEntity)
    private readonly unPopRepo: Repository<UnPopulationEntity>,
    @InjectRepository(UnescoUisEntity)
    private readonly uisRepo: Repository<UnescoUisEntity>,
    @InjectRepository(IloFowTaskIndexEntity)
    private readonly iloFowRepo: Repository<IloFowTaskIndexEntity>,
    @InjectRepository(ItuDigitalEntity)
    private readonly ituRepo: Repository<ItuDigitalEntity>,
    @InjectRepository(OnetTaskEntity)
    private readonly onetRepo: Repository<OnetTaskEntity>,
    @InjectRepository(EscoSkillEntity)
    private readonly escoRepo: Repository<EscoSkillEntity>,
    @InjectRepository(IscoOccupationEntity)
    private readonly iscoRepo: Repository<IscoOccupationEntity>,
    @InjectRepository(DocumentChunkEntity)
    private readonly chunkRepo: Repository<DocumentChunkEntity>,
    @InjectRepository(CustomRecordEntity)
    private readonly customRecordRepo: Repository<CustomRecordEntity>,
    private readonly milvus: MilvusVectorClient,
  ) {}

  // ---------- Sources ----------

  async ensureSource(
    slug: string,
    spec: {
      displayName?: string;
      sourceUrl?: string | null;
      cron?: string | null;
      category?: string | null;
      kind?: 'harvester' | 'upload';
    } = {},
  ): Promise<DataSourceEntity> {
    const existing = await this.sourceRepo.findOne({ where: { slug } });
    if (existing) {
      let dirty = false;
      if (spec.displayName && existing.displayName !== spec.displayName) {
        existing.displayName = spec.displayName;
        dirty = true;
      }
      if (spec.cron !== undefined && existing.cron !== spec.cron) {
        existing.cron = spec.cron;
        dirty = true;
      }
      if (spec.sourceUrl !== undefined && existing.sourceUrl !== spec.sourceUrl) {
        existing.sourceUrl = spec.sourceUrl;
        dirty = true;
      }
      if (spec.category !== undefined && existing.category !== spec.category) {
        existing.category = spec.category;
        dirty = true;
      }
      if (dirty) await this.sourceRepo.save(existing);
      return existing;
    }
    const created = this.sourceRepo.create({
      slug,
      displayName: spec.displayName ?? slug,
      sourceUrl: spec.sourceUrl ?? null,
      cron: spec.cron ?? null,
      category: spec.category ?? null,
      kind: spec.kind ?? 'harvester',
      isActive: true,
    });
    return this.sourceRepo.save(created);
  }

  async createSource(input: {
    slug: string;
    displayName: string;
    kind?: 'harvester' | 'upload';
    sourceUrl?: string | null;
    cron?: string | null;
    category?: string | null;
    schemaSpec?: Record<string, unknown> | null;
    note?: string | null;
  }): Promise<DataSourceEntity> {
    const ent = this.sourceRepo.create({
      slug: input.slug,
      displayName: input.displayName,
      kind: input.kind ?? 'upload',
      sourceUrl: input.sourceUrl ?? null,
      cron: input.cron ?? null,
      category: input.category ?? null,
      schemaSpec: input.schemaSpec ?? null,
      note: input.note ?? null,
      isActive: true,
    });
    return this.sourceRepo.save(ent);
  }

  async patchSource(
    id: string,
    patch: Partial<
      Pick<
        DataSourceEntity,
        | 'displayName'
        | 'sourceUrl'
        | 'cron'
        | 'category'
        | 'isActive'
        | 'note'
        | 'schemaSpec'
      >
    >,
  ): Promise<DataSourceEntity> {
    const source = await this.sourceRepo.findOne({ where: { id } });
    if (!source) throw new NotFoundException(`Source ${id} not found`);
    Object.assign(source, patch);
    return this.sourceRepo.save(source);
  }

  async getSourceBySlug(slug: string): Promise<DataSourceEntity | null> {
    return this.sourceRepo.findOne({ where: { slug } });
  }

  async getSourceById(id: string): Promise<DataSourceEntity | null> {
    return this.sourceRepo.findOne({ where: { id } });
  }

  async listSources(): Promise<DataSourceListItem[]> {
    const sources = await this.sourceRepo.find({ order: { slug: 'ASC' } });
    if (sources.length === 0) return [];
    const ids = sources.map((s) => s.id);
    const runs = await this.runRepo
      .createQueryBuilder('r')
      .where('r.dataSourceId IN (:...ids)', { ids })
      .orderBy('r.startedAt', 'DESC')
      .getMany();
    const lastRunBySource = new Map<string, DatasetRunEntity>();
    const totalsBySource = new Map<string, number>();
    for (const run of runs) {
      totalsBySource.set(
        run.dataSourceId,
        (totalsBySource.get(run.dataSourceId) ?? 0) + 1,
      );
      if (!lastRunBySource.has(run.dataSourceId)) {
        lastRunBySource.set(run.dataSourceId, run);
      }
    }
    return sources.map((s) => ({
      id: s.id,
      slug: s.slug,
      displayName: s.displayName,
      kind: s.kind,
      sourceUrl: s.sourceUrl,
      cron: s.cron,
      category: s.category,
      isActive: s.isActive,
      note: s.note,
      schemaSpec: s.schemaSpec,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      lastRun: this.toRunListItem(lastRunBySource.get(s.id), s.slug),
      totalRuns: totalsBySource.get(s.id) ?? 0,
    }));
  }

  async listRunsForSource(
    sourceId: string,
    limit = 50,
  ): Promise<DatasetRunListItem[]> {
    const source = await this.sourceRepo.findOne({ where: { id: sourceId } });
    if (!source) throw new NotFoundException(`Source ${sourceId} not found`);
    const runs = await this.runRepo.find({
      where: { dataSourceId: sourceId },
      order: { startedAt: 'DESC' },
      take: limit,
    });
    return runs
      .map((r) => this.toRunListItem(r, source.slug))
      .filter((r): r is DatasetRunListItem => r !== null);
  }

  async listRecentRuns(limit = 50): Promise<DatasetRunListItem[]> {
    const runs = await this.runRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.dataSource', 's')
      .orderBy('r.startedAt', 'DESC')
      .take(limit)
      .getMany();
    return runs
      .map((r) => this.toRunListItem(r, r.dataSource?.slug ?? 'unknown'))
      .filter((r): r is DatasetRunListItem => r !== null);
  }

  // ---------- Runs ----------

  async openRun(
    slug: string,
    opts: OpenRunOptions = {},
  ): Promise<{ runId: string; sourceId: string }> {
    const source = await this.ensureSource(slug, {
      displayName: opts.ensureSource?.displayName,
      sourceUrl: opts.ensureSource?.sourceUrl,
      cron: opts.ensureSource?.cron,
      category: opts.ensureSource?.category,
      kind: opts.ensureSource?.sourceKind,
    });
    const run = this.runRepo.create({
      dataSourceId: source.id,
      status: 'pending',
      kind: opts.kind ?? 'cron',
      startedAt: new Date(),
      filename: opts.filename ?? null,
      fileChecksum: opts.fileChecksum ?? null,
    });
    const saved = await this.runRepo.save(run);
    return { runId: saved.id, sourceId: source.id };
  }

  async closeRun(runId: string, opts: CloseRunOptions): Promise<void> {
    await this.runRepo.update(
      { id: runId },
      {
        status: opts.status,
        recordCount: opts.recordCount ?? 0,
        error: opts.error ?? null,
        archivePath: opts.archivePath ?? null,
        finishedAt: new Date(),
      },
    );
  }

  async getRun(runId: string): Promise<DatasetRunEntity | null> {
    return this.runRepo.findOne({
      where: { id: runId },
      relations: ['dataSource'],
    });
  }

  /**
   * Most recent OK run for a given source, used by the startup harvest
   * gate (freshness check) and by /health/data-status. Returns null if
   * the source has no successful run yet.
   */
  async getLastSuccessfulRun(
    dataSourceId: string,
  ): Promise<DatasetRunEntity | null> {
    return this.runRepo.findOne({
      where: { dataSourceId, status: 'ok' },
      order: { finishedAt: 'DESC' },
    });
  }

  // ---------- Cascade deletion ----------

  /**
   * Removes every Postgres row tagged with `runId` across all known
   * persisted entities, then evicts the matching vectors from Milvus,
   * deletes the JSON archive, and finally drops the run row itself.
   */
  async deleteRun(runId: string): Promise<{ deletedRows: number }> {
    const run = await this.runRepo.findOne({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);

    let total = 0;

    // ESCO carries vectors in Milvus → collect codes before deleting.
    try {
      const escoRows = await this.escoRepo.find({
        where: { runId },
        select: ['code'],
      });
      const escoCodes = escoRows.map((r) => r.code);
      if (escoCodes.length > 0) {
        try {
          await this.milvus.deleteByIds(ESCO_VECTOR_COLLECTION, escoCodes);
        } catch (err) {
          this.logger.warn(
            `Milvus delete from ${ESCO_VECTOR_COLLECTION} failed for run ${runId}: ${(err as Error).message}`,
          );
        }
      }
      const r = await this.escoRepo.delete({ runId });
      total += r.affected ?? 0;
    } catch (err) {
      this.logger.warn(`ESCO delete failed: ${(err as Error).message}`);
    }

    // O*NET tasks have an associated Milvus collection; clean it first.
    try {
      const onetRows = await this.onetRepo.find({
        where: { runId },
        select: ['onetCode', 'taskId'],
      });
      const onetIds = onetRows.map((r) => `${r.onetCode}:${r.taskId}`);
      if (onetIds.length > 0) {
        try {
          await this.milvus.deleteByIds(ONET_VECTOR_COLLECTION, onetIds);
        } catch (err) {
          this.logger.warn(
            `Milvus delete from ${ONET_VECTOR_COLLECTION} failed for run ${runId}: ${(err as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `O*NET pre-vector lookup failed: ${(err as Error).message}`,
      );
    }

    // Document corpora — group by corpus so we hit each Milvus collection
    // once. First-party corpora (`policy_reports`, `training_programs`)
    // map to their dedicated collection. Anything else is an admin-defined
    // custom corpus, which lives in `unmapped_custom_<slug>`.
    try {
      const chunkRows = await this.chunkRepo.find({
        where: { runId },
        select: ['corpus', 'documentId', 'chunkIndex'],
      });
      const idsByCollection = new Map<string, string[]>();
      for (const r of chunkRows) {
        const id = `${r.documentId}:${r.chunkIndex}`;
        const collection =
          KNOWN_CORPUS_COLLECTIONS[r.corpus] ?? customCollectionFor(r.corpus);
        const list = idsByCollection.get(collection) ?? [];
        list.push(id);
        idsByCollection.set(collection, list);
      }
      for (const [collection, ids] of idsByCollection.entries()) {
        try {
          await this.milvus.deleteByIds(collection, ids);
        } catch (err) {
          this.logger.warn(
            `Milvus delete from ${collection} failed for run ${runId}: ${(err as Error).message}`,
          );
        }
      }
      const r = await this.chunkRepo.delete({ runId });
      total += r.affected ?? 0;
    } catch (err) {
      this.logger.warn(
        `Document chunk cascade failed: ${(err as Error).message}`,
      );
    }

    // Generic structured table for admin-defined sources. No Milvus side
    // effects — it's a pure Postgres JSONB drop.
    try {
      const r = await this.customRecordRepo.delete({ runId });
      total += r.affected ?? 0;
    } catch (err) {
      this.logger.warn(
        `custom_records cascade failed: ${(err as Error).message}`,
      );
    }

    const cascadeRepos: Repository<{ runId: string | null }>[] = [
      this.iscoRepo as unknown as Repository<{ runId: string | null }>,
      this.wageRepo as unknown as Repository<{ runId: string | null }>,
      this.growthRepo as unknown as Repository<{ runId: string | null }>,
      this.freyRepo as unknown as Repository<{ runId: string | null }>,
      this.calRepo as unknown as Repository<{ runId: string | null }>,
      this.wbRepo as unknown as Repository<{ runId: string | null }>,
      this.ilostatRepo as unknown as Repository<{ runId: string | null }>,
      this.wcdeRepo as unknown as Repository<{ runId: string | null }>,
      this.unPopRepo as unknown as Repository<{ runId: string | null }>,
      this.uisRepo as unknown as Repository<{ runId: string | null }>,
      this.iloFowRepo as unknown as Repository<{ runId: string | null }>,
      this.ituRepo as unknown as Repository<{ runId: string | null }>,
      this.onetRepo as unknown as Repository<{ runId: string | null }>,
    ];
    for (const repo of cascadeRepos) {
      try {
        const r = await repo.delete({ runId });
        total += r.affected ?? 0;
      } catch (err) {
        this.logger.warn(
          `Cascade delete in ${repo.metadata.tableName} failed: ${(err as Error).message}`,
        );
      }
    }

    if (run.archivePath) {
      try {
        if (await fs.pathExists(run.archivePath)) {
          await fs.remove(run.archivePath);
        }
      } catch (err) {
        this.logger.warn(
          `Archive cleanup failed for ${run.archivePath}: ${(err as Error).message}`,
        );
      }
    }

    await this.runRepo.delete({ id: runId });
    this.logger.log(`Run ${runId} deleted (cascade removed ${total} rows).`);
    return { deletedRows: total };
  }

  /** Cascade-delete every run for a source, then the source itself. */
  async deleteSource(
    sourceId: string,
  ): Promise<{ deletedRuns: number; deletedRows: number }> {
    const source = await this.sourceRepo.findOne({ where: { id: sourceId } });
    if (!source) throw new NotFoundException(`Source ${sourceId} not found`);
    const runs = await this.runRepo.find({ where: { dataSourceId: sourceId } });
    let totalRows = 0;
    for (const run of runs) {
      const { deletedRows } = await this.deleteRun(run.id);
      totalRows += deletedRows;
    }
    await this.sourceRepo.delete({ id: sourceId });
    return { deletedRuns: runs.length, deletedRows: totalRows };
  }

  // ---------- helpers ----------

  private toRunListItem(
    run: DatasetRunEntity | undefined,
    sourceSlug: string,
  ): DatasetRunListItem | null {
    if (!run) return null;
    return {
      id: run.id,
      dataSourceId: run.dataSourceId,
      sourceSlug,
      status: run.status,
      kind: run.kind,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
      recordCount: run.recordCount,
      error: run.error,
      archivePath: run.archivePath,
      fileChecksum: run.fileChecksum,
      filename: run.filename,
    };
  }
}
