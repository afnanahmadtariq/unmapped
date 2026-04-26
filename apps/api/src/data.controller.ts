import { Controller, Get, Post, Param, Query, NotFoundException } from '@nestjs/common';
import { HarvestService } from './harvest/harvest.service';

@Controller()
export class DataController {
  constructor(private readonly harvest: HarvestService) {}

  // /health and /health/data-status moved to HealthController.

  /** GET /schedule — List all cron schedules */
  @Get('schedule')
  schedule() {
    return this.harvest.getSchedule();
  }

  /** GET /datasets — List all saved datasets with metadata */
  @Get('datasets')
  async listDatasets() {
    return this.harvest.getStorageService().listAll();
  }

  /** GET /datasets/:sourceId — Get full dataset */
  @Get('datasets/:sourceId')
  async getDataset(
    @Param('sourceId') sourceId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('country') country?: string,
  ) {
    const dataset = await this.harvest.getStorageService().load(sourceId);
    if (!dataset) throw new NotFoundException(`Dataset '${sourceId}' not found. Run POST /harvest/${sourceId} first.`);

    let records = dataset.records;

    // Optional filtering by countryCode
    if (country) {
      records = records.filter(r =>
        (r.countryCode || r.country_code || r.iso3 || r.refArea || '').toLowerCase() === country.toLowerCase()
      );
    }

    // Pagination
    const off = parseInt(offset || '0', 10);
    const lim = parseInt(limit || '100', 10);
    const paginated = records.slice(off, off + lim);

    return {
      sourceId: dataset.sourceId,
      sourceName: dataset.sourceName,
      category: dataset.category,
      lastFetched: dataset.lastFetched,
      nextScheduled: dataset.nextScheduled,
      totalRecords: records.length,
      offset: off,
      limit: lim,
      fields: dataset.fields,
      metadata: dataset.metadata,
      records: paginated,
    };
  }

  /** POST /harvest/:sourceId — Manually trigger a single harvester */
  @Post('harvest/:sourceId')
  async harvestOne(@Param('sourceId') sourceId: string) {
    return this.harvest.runOne(sourceId);
  }

  /** POST /harvest — Trigger ALL harvesters */
  @Post('harvest')
  async harvestAll() {
    return this.harvest.runAll();
  }
}
