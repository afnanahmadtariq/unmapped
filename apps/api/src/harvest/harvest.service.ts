import { Injectable, Logger } from '@nestjs/common';
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
import { StorageService } from '../storage/storage.service';
import cron from 'node-cron';

@Injectable()
export class HarvestService {
  private readonly logger = new Logger(HarvestService.name);

  private readonly harvesterMap: Record<string, BaseHarvester>;

  constructor(
    private readonly storage: StorageService,
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
    };
  }

  /** Manually trigger a specific harvester by sourceId */
  async runOne(
    sourceId: string,
  ): Promise<{ success: boolean; message: string }> {
    const harvester = this.harvesterMap[sourceId];
    if (!harvester) {
      return { success: false, message: `Unknown sourceId: ${sourceId}` };
    }
    try {
      await harvester.harvest();
      return { success: true, message: `${sourceId} harvested successfully` };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /** Manually trigger ALL harvesters in parallel */
  async runAll(): Promise<
    { sourceId: string; success: boolean; message: string }[]
  > {
    const results = await Promise.allSettled(
      Object.entries(this.harvesterMap).map(async ([id, h]) => {
        try {
          await h.harvest();
          return { sourceId: id, success: true, message: 'OK' };
        } catch (e: any) {
          return { sourceId: id, success: false, message: e.message };
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
}
