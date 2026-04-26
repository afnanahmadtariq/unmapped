import { Module } from '@nestjs/common';
import { CountryModule } from '../country/country.module';
import { SignalsModule } from '../signals/signals.module';
import { IscoModule } from '../taxonomies/isco/isco.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

// ExternalModule (WorldBankApiClient) is @Global() — no need to import explicitly.
@Module({
  imports: [CountryModule, SignalsModule, IscoModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
