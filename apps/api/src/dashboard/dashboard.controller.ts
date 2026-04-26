import { Controller, Get, Param } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** GET /dashboard/snapshot/:countryCode
   * Returns the full policy dashboard payload for the given country.
   */
  @Get('snapshot/:countryCode')
  getSnapshot(@Param('countryCode') countryCode: string) {
    return this.dashboard.getSnapshot(countryCode);
  }
}
