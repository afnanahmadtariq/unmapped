import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CountryModule } from '../country/country.module';
import { IscoModule } from '../taxonomies/isco/isco.module';
import { WageEntity } from './entities/wage.entity';
import { SectorGrowthEntity } from './entities/sector-growth.entity';
import { FreyOsborneEntity } from './entities/frey-osborne.entity';
import { CountryCalibrationEntity } from './entities/country-calibration.entity';
import { WbIndicatorPointEntity } from './entities/wb-indicator.entity';
import { SignalsService } from './signals.service';
import { SignalsController } from './signals.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WageEntity,
      SectorGrowthEntity,
      FreyOsborneEntity,
      CountryCalibrationEntity,
      WbIndicatorPointEntity,
    ]),
    CountryModule,
    IscoModule,
  ],
  controllers: [SignalsController],
  providers: [SignalsService],
  exports: [SignalsService],
})
export class SignalsModule {}
