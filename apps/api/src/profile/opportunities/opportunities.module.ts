import { Module } from '@nestjs/common';
import { CountryModule } from '../../country/country.module';
import { SignalsModule } from '../../signals/signals.module';
import { OpportunitiesService } from './opportunities.service';
import { OpportunitiesController } from './opportunities.controller';

@Module({
  imports: [CountryModule, SignalsModule],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
