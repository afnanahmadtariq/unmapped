import { Controller, Get, Param } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** GET /admin/config-summary/:countryCode
   * Returns dataset counts, calibration details, and snapshot country list
   * for the admin configuration page.
   */
  @Get('config-summary/:countryCode')
  getConfigSummary(@Param('countryCode') countryCode: string) {
    return this.admin.getConfigSummary(countryCode);
  }
}
