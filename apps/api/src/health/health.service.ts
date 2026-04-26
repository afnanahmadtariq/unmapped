import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EscoApiClient } from '../external/esco-api.client';
import { WorldBankApiClient } from '../external/world-bank.client';
import { MilvusVectorClient } from '../infra/vector/milvus.client';
import { DatasetRunEntity } from '../lineage/dataset-run.entity';
import { DataSourceEntity } from '../lineage/data-source.entity';

export type DataFreshness = 'live' | 'snapshot' | 'stale' | 'never';

export interface DataStatus {
  esco: 'live' | 'snapshot';
  worldBank: 'live' | 'snapshot';
  postgres: 'live' | 'down';
  milvus: 'live' | 'down';
  ilostat: DataFreshness;
  freyOsborne: DataFreshness;
  /** Last successful run timestamp per harvester slug (ISO string or null). */
  lastRunBySource: Record<string, string | null>;
  checkedAt: string;
}

/** Slugs whose freshness we surface in the legacy DataStatus shape. */
const FRESHNESS_SLUGS: Array<{
  slug: string;
  staleAfterDays: number;
}> = [
  { slug: 'ilo-ilostat', staleAfterDays: 90 },
  { slug: 'frey-osborne', staleAfterDays: 365 * 3 },
  { slug: 'wb-wdi', staleAfterDays: 90 },
  { slug: 'wb-hci', staleAfterDays: 365 },
  { slug: 'esco', staleAfterDays: 180 },
  { slug: 'onet', staleAfterDays: 180 },
  { slug: 'wittgenstein', staleAfterDays: 365 },
  { slug: 'un-population', staleAfterDays: 365 },
  { slug: 'unesco-uis', staleAfterDays: 365 },
  { slug: 'ilo-fow', staleAfterDays: 365 },
  { slug: 'itu-digital', staleAfterDays: 365 },
];

/**
 * Health probes for every backing service. Replaces /api/data-status from
 * the web app and adds the Postgres + Milvus checks the new architecture
 * cares about. Freshness for harvested sources is now derived from
 * `dataset_runs.finishedAt` instead of being hard-coded as 'snapshot'.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly esco: EscoApiClient,
    private readonly wb: WorldBankApiClient,
    private readonly milvus: MilvusVectorClient,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(DatasetRunEntity)
    private readonly runRepo: Repository<DatasetRunEntity>,
    @InjectRepository(DataSourceEntity)
    private readonly sourceRepo: Repository<DataSourceEntity>,
  ) {}

  async dataStatus(): Promise<DataStatus> {
    const [escoOk, wbOk, pgOk, milvusOk, freshness] = await Promise.all([
      this.esco.probe(),
      this.wb.probe(),
      this.probePostgres(),
      this.probeMilvus(),
      this.lastRunFreshness(),
    ]);
    return {
      esco: escoOk ? 'live' : 'snapshot',
      worldBank: wbOk ? 'live' : 'snapshot',
      postgres: pgOk ? 'live' : 'down',
      milvus: milvusOk ? 'live' : 'down',
      ilostat: freshness.statuses['ilo-ilostat'] ?? 'never',
      freyOsborne: freshness.statuses['frey-osborne'] ?? 'never',
      lastRunBySource: freshness.timestamps,
      checkedAt: new Date().toISOString(),
    };
  }

  private async lastRunFreshness(): Promise<{
    statuses: Record<string, DataFreshness>;
    timestamps: Record<string, string | null>;
  }> {
    const statuses: Record<string, DataFreshness> = {};
    const timestamps: Record<string, string | null> = {};
    try {
      const sources = await this.sourceRepo.find({
        select: ['id', 'slug'],
      });
      const bySlug = new Map(sources.map((s) => [s.slug, s.id]));
      const now = Date.now();
      for (const { slug, staleAfterDays } of FRESHNESS_SLUGS) {
        const id = bySlug.get(slug);
        if (!id) {
          statuses[slug] = 'never';
          timestamps[slug] = null;
          continue;
        }
        const lastRun = await this.runRepo.findOne({
          where: { dataSourceId: id, status: 'ok' },
          order: { finishedAt: 'DESC' },
        });
        if (!lastRun?.finishedAt) {
          statuses[slug] = 'never';
          timestamps[slug] = null;
          continue;
        }
        const ageDays =
          (now - lastRun.finishedAt.getTime()) / (24 * 60 * 60 * 1000);
        statuses[slug] =
          ageDays > staleAfterDays
            ? 'stale'
            : ageDays > 1
              ? 'snapshot'
              : 'live';
        timestamps[slug] = lastRun.finishedAt.toISOString();
      }
    } catch (err) {
      this.logger.warn(
        `Freshness lookup failed: ${(err as Error).message}. Returning 'never' for all sources.`,
      );
    }
    return { statuses, timestamps };
  }

  private async probePostgres(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private async probeMilvus(): Promise<boolean> {
    try {
      const res = await this.milvus
        .raw()
        .getMetric({ request: { metric_type: 'system_info' } });
      return !!res;
    } catch {
      return false;
    }
  }
}
