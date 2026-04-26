import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BaseHarvester } from './base.harvester';
import { IloIlostatHarvester } from './harvesters/ilo-ilostat.harvester';
import { WorldBankWdiHarvester } from './harvesters/wb-wdi.harvester';
import { WorldBankHciHarvester } from './harvesters/wb-hci.harvester';
import { IloIscoHarvester } from './harvesters/ilo-isco.harvester';
import { UnPopulationHarvester } from './harvesters/un-population.harvester';
import { WittgensteinHarvester } from './harvesters/wittgenstein.harvester';
import { UnescoUisHarvester } from './harvesters/unesco-uis.harvester';
import { FreyOsborneHarvester } from './harvesters/frey-osborne.harvester';
import { IloFowHarvester } from './harvesters/ilo-fow.harvester';
import { ItuDigitalHarvester } from './harvesters/itu-digital.harvester';
import { EscoHarvester } from './harvesters/esco.harvester';
import { OnetHarvester } from './harvesters/onet.harvester';
import { StorageService } from '../storage/storage.service';
import { LineageService } from '../lineage/lineage.service';
import { EnvService } from '../infra/config/env.service';
import { DbnomicsClient } from '../external/dbnomics.client';
import cron from 'node-cron';

@Injectable()
export class HarvestService implements OnModuleInit {
  private readonly logger = new Logger(HarvestService.name);

  private readonly harvesterMap: Record<string, BaseHarvester>;

  constructor(
    private readonly storage: StorageService,
    private readonly lineage: LineageService,
    private readonly env: EnvService,
    private readonly dbnomics: DbnomicsClient,
    private readonly iloIlostat: IloIlostatHarvester,
    private readonly wbWdi: WorldBankWdiHarvester,
    private readonly wbHci: WorldBankHciHarvester,
    private readonly iloIsco: IloIscoHarvester,
    private readonly unPop: UnPopulationHarvester,
    private readonly wittgenstein: WittgensteinHarvester,
    private readonly unescoUis: UnescoUisHarvester,
    private readonly freyOsborne: FreyOsborneHarvester,
    private readonly iloFow: IloFowHarvester,
    private readonly ituDigital: ItuDigitalHarvester,
    private readonly esco: EscoHarvester,
    private readonly onet: OnetHarvester,
  ) {
    this.harvesterMap = {
      'ilo-ilostat': iloIlostat,
      'wb-wdi': wbWdi,
      'wb-hci': wbHci,
      'ilo-isco': iloIsco,
      'un-population': unPop,
      wittgenstein: wittgenstein,
      'unesco-uis': unescoUis,
      'frey-osborne': freyOsborne,
      'ilo-fow': iloFow,
      'itu-digital': ituDigital,
      esco: esco,
      onet: onet,
    };
  }

  /**
   * Wire the lineage service into every harvester so each `persist()` call
   * opens + closes a `dataset_runs` row, and pre-register every source in
   * `data_sources` so the admin UI can see it even before its first run.
   */
  async onModuleInit(): Promise<void> {
    for (const [slug, harvester] of Object.entries(this.harvesterMap)) {
      harvester.setLineage(this.lineage);
      harvester.setDbnomics(this.dbnomics);
      try {
        await this.lineage.ensureSource(slug, {
          displayName: harvester.sourceName,
          sourceUrl: harvester.sourceUrl,
          cron: harvester.cronExpression,
          category: harvester.sourceCategory,
          kind: 'harvester',
        });
      } catch (err) {
        this.logger.warn(
          `Could not register data_source row for ${slug}: ${(err as Error).message}`,
        );
      }
    }

    const uploadSeeds: Array<{
      slug: string;
      displayName: string;
      category: string;
    }> = [
      {
        slug: 'policy_reports',
        displayName: 'Policy reports (admin uploads)',
        category: 'rag-corpus',
      },
      {
        slug: 'training_programs',
        displayName: 'Training programs (admin uploads)',
        category: 'rag-corpus',
      },
    ];
    for (const seed of uploadSeeds) {
      try {
        await this.lineage.ensureSource(seed.slug, {
          displayName: seed.displayName,
          category: seed.category,
          kind: 'upload',
        });
      } catch (err) {
        this.logger.warn(
          `Could not register upload source ${seed.slug}: ${(err as Error).message}`,
        );
      }
    }

    this.scheduleStartupHarvest();
  }

  /**
   * Kicks off a sequential startup harvest in the background after a short
   * delay (so DB / Milvus connections are warm). Sources whose most recent
   * successful run is younger than `HARVEST_STARTUP_FRESHNESS_HOURS` are
   * skipped, so restarting the API never re-fetches fresh data.
   */
  private scheduleStartupHarvest(): void {
    if (!this.env.get('HARVEST_ON_STARTUP')) {
      this.logger.log(
        'Startup harvest disabled (HARVEST_ON_STARTUP=false). ' +
          'Sources will only refresh on their cron schedules or manual triggers.',
      );
      return;
    }
    const delay = this.env.get('HARVEST_STARTUP_DELAY_MS');
    this.logger.log(
      `Startup harvest scheduled in ${delay}ms (set HARVEST_ON_STARTUP=false to disable).`,
    );
    setTimeout(() => {
      void this.runStartupHarvest().catch((err) =>
        this.logger.error(`Startup harvest crashed: ${err?.message ?? err}`),
      );
    }, delay);
  }

  private async runStartupHarvest(): Promise<void> {
    const freshnessHours = this.env.get('HARVEST_STARTUP_FRESHNESS_HOURS');
    const cutoff = Date.now() - freshnessHours * 60 * 60 * 1000;
    const slugs = Object.keys(this.harvesterMap);
    this.logger.log(
      `Startup harvest: ${slugs.length} sources, freshness window=${freshnessHours}h.`,
    );

    let ran = 0;
    let skipped = 0;
    let failed = 0;
    for (const slug of slugs) {
      try {
        const source = await this.lineage.getSourceBySlug(slug);
        if (source) {
          const lastRun = await this.lineage.getLastSuccessfulRun(source.id);
          if (
            lastRun?.finishedAt &&
            lastRun.finishedAt.getTime() > cutoff
          ) {
            skipped += 1;
            this.logger.log(
              `Startup harvest: ${slug} fresh (last ok ${lastRun.finishedAt.toISOString()}) — skipping.`,
            );
            continue;
          }
        }
        const harvester = this.harvesterMap[slug];
        harvester.setNextRunKind('startup');
        try {
          await harvester.harvest();
          ran += 1;
          this.logger.log(`Startup harvest: ${slug} ✓`);
        } catch (err) {
          failed += 1;
          this.logger.warn(
            `Startup harvest: ${slug} failed: ${(err as Error).message}`,
          );
        } finally {
          harvester.setNextRunKind(null);
        }
      } catch (err) {
        failed += 1;
        this.logger.warn(
          `Startup harvest: ${slug} bootstrap failed: ${(err as Error).message}`,
        );
      }
    }
    this.logger.log(
      `Startup harvest complete — ran=${ran}, skipped=${skipped}, failed=${failed}.`,
    );
  }

  /**
   * Manually trigger a specific harvester by sourceId.
   *
   * This is the single dispatch point shared by:
   *   - Cron-driven runs (via the harvester's own @Cron decorator, which
   *     ultimately funnels through `BaseHarvester.persist()` and produces
   *     a `dataset_runs` row tagged kind='cron').
   *   - Admin manual triggers (this method, which sets kind='manual'
   *     before delegating to the same harvest() body).
   *
   * Both paths are identical from a lineage / archive / loader standpoint
   * — only the run kind differs — satisfying the Phase 6 unification goal.
   */
  async runOne(
    sourceId: string,
  ): Promise<{ success: boolean; message: string }> {
    const harvester = this.harvesterMap[sourceId];
    if (!harvester) {
      return { success: false, message: `Unknown sourceId: ${sourceId}` };
    }
    harvester.setNextRunKind('manual');
    try {
      await harvester.harvest();
      return { success: true, message: `${sourceId} harvested successfully` };
    } catch (err: any) {
      return { success: false, message: err.message };
    } finally {
      harvester.setNextRunKind(null);
    }
  }

  /** Manually trigger ALL harvesters in parallel */
  async runAll(): Promise<
    { sourceId: string; success: boolean; message: string }[]
  > {
    const results = await Promise.allSettled(
      Object.entries(this.harvesterMap).map(async ([id, h]) => {
        h.setNextRunKind('manual');
        try {
          await h.harvest();
          return { sourceId: id, success: true, message: 'OK' };
        } catch (e: any) {
          return { sourceId: id, success: false, message: e.message };
        } finally {
          h.setNextRunKind(null);
        }
      }),
    );
    return results.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { sourceId: 'unknown', success: false, message: 'Rejected' },
    );
  }

  /** List all harvester source IDs and validate their cron expressions */
  getSchedule(): { sourceId: string; cron: string; valid: boolean }[] {
    return Object.entries(this.harvesterMap).map(([id, h]) => ({
      sourceId: id,
      cron: h.cronExpression,
      valid: cron.validate(h.cronExpression),
    }));
  }

  getStorageService() {
    return this.storage;
  }

  /** Lookup the slug -> harvester for the admin manual-trigger endpoint. */
  getHarvesterSlugs(): string[] {
    return Object.keys(this.harvesterMap);
  }
}
