import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EscoApiClient } from '../external/esco-api.client';
import { WorldBankApiClient } from '../external/world-bank.client';
import { MilvusVectorClient } from '../infra/vector/milvus.client';

export interface DataStatus {
  esco: 'live' | 'snapshot';
  worldBank: 'live' | 'snapshot';
  postgres: 'live' | 'down';
  milvus: 'live' | 'down';
  ilostat: 'snapshot';
  freyOsborne: 'snapshot';
  checkedAt: string;
}

/**
 * Health probes for every backing service. Replaces /api/data-status from
 * the web app and adds the Postgres + Milvus checks the new architecture
 * cares about.
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly esco: EscoApiClient,
    private readonly wb: WorldBankApiClient,
    private readonly milvus: MilvusVectorClient,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async dataStatus(): Promise<DataStatus> {
    const [escoOk, wbOk, pgOk, milvusOk] = await Promise.all([
      this.esco.probe(),
      this.wb.probe(),
      this.probePostgres(),
      this.probeMilvus(),
    ]);
    return {
      esco: escoOk ? 'live' : 'snapshot',
      worldBank: wbOk ? 'live' : 'snapshot',
      postgres: pgOk ? 'live' : 'down',
      milvus: milvusOk ? 'live' : 'down',
      ilostat: 'snapshot',
      freyOsborne: 'snapshot',
      checkedAt: new Date().toISOString(),
    };
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
