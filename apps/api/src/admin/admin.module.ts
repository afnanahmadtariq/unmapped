import { Module } from '@nestjs/common';
import { CountryModule } from '../country/country.module';
import { SignalsModule } from '../signals/signals.module';
import { TaxonomiesModule } from '../taxonomies/taxonomies.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [CountryModule, SignalsModule, TaxonomiesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
