import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CountryModule } from '../country/country.module';
import { IscoModule } from '../taxonomies/isco/isco.module';
import { JobsModule } from '../jobs/jobs.module';
import { WageEntity } from './entities/wage.entity';
import { SectorGrowthEntity } from './entities/sector-growth.entity';
import { FreyOsborneEntity } from './entities/frey-osborne.entity';
import { CountryCalibrationEntity } from './entities/country-calibration.entity';
import { WbIndicatorPointEntity } from './entities/wb-indicator.entity';
import { IlostatTimeSeriesEntity } from './entities/ilostat-time-series.entity';
import { WittgensteinProjectionEntity } from './entities/wittgenstein-projection.entity';
import { UnPopulationEntity } from './entities/un-population.entity';
import { UnescoUisEntity } from './entities/unesco-uis.entity';
import { IloFowTaskIndexEntity } from './entities/ilo-fow-task-index.entity';
import { ItuDigitalEntity } from './entities/itu-digital.entity';
import { OnetTaskEntity } from './entities/onet-task.entity';
import { SignalsService } from './signals.service';
import { OnetIngestService } from './onet-ingest.service';
import { OnetSearchService } from './onet-search.service';
import { CompositeSignalService } from './computed/composite.service';
import { SignalsController } from './signals.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WageEntity,
      SectorGrowthEntity,
      FreyOsborneEntity,
      CountryCalibrationEntity,
      WbIndicatorPointEntity,
      IlostatTimeSeriesEntity,
      WittgensteinProjectionEntity,
      UnPopulationEntity,
      UnescoUisEntity,
      IloFowTaskIndexEntity,
      ItuDigitalEntity,
      OnetTaskEntity,
    ]),
    CountryModule,
    IscoModule,
    forwardRef(() => JobsModule),
  ],
  controllers: [SignalsController],
  providers: [
    SignalsService,
    OnetIngestService,
    OnetSearchService,
    CompositeSignalService,
  ],
  exports: [
    SignalsService,
    OnetIngestService,
    OnetSearchService,
    CompositeSignalService,
    TypeOrmModule,
  ],
})
export class SignalsModule {}
