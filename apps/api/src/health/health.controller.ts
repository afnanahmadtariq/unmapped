import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('health')
  basic() {
    return {
      status: 'ok',
      service: 'cartographer-api',
      timestamp: new Date().toISOString(),
    };
  }

  /** Same shape (and superset) as the legacy /api/data-status route. */
  @Get('health/data-status')
  dataStatus() {
    return this.health.dataStatus();
  }
}
