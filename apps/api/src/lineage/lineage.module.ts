import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSourceEntity } from './data-source.entity';
import { DatasetRunEntity } from './dataset-run.entity';
import { LineageService } from './lineage.service';
import { WageEntity } from '../signals/entities/wage.entity';
import { SectorGrowthEntity } from '../signals/entities/sector-growth.entity';
import { FreyOsborneEntity } from '../signals/entities/frey-osborne.entity';
import { CountryCalibrationEntity } from '../signals/entities/country-calibration.entity';
import { WbIndicatorPointEntity } from '../signals/entities/wb-indicator.entity';
import { IlostatTimeSeriesEntity } from '../signals/entities/ilostat-time-series.entity';
import { WittgensteinProjectionEntity } from '../signals/entities/wittgenstein-projection.entity';
import { UnPopulationEntity } from '../signals/entities/un-population.entity';
import { UnescoUisEntity } from '../signals/entities/unesco-uis.entity';
import { IloFowTaskIndexEntity } from '../signals/entities/ilo-fow-task-index.entity';
import { ItuDigitalEntity } from '../signals/entities/itu-digital.entity';
import { OnetTaskEntity } from '../signals/entities/onet-task.entity';
import { EscoSkillEntity } from '../taxonomies/esco/esco.entity';
import { IscoOccupationEntity } from '../taxonomies/isco/isco.entity';
import { DocumentChunkEntity } from '../corpora/document-chunk.entity';
import { CustomRecordEntity } from '../storage/custom-record.entity';

/**
 * Global module so any harvester / loader / admin route can depend on
 * `LineageService` without having to import this module explicitly.
 *
 * Re-registers the persisted entities via `forFeature` to give the
 * service direct repository access for the cascade-delete path.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DataSourceEntity,
      DatasetRunEntity,
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
      EscoSkillEntity,
      IscoOccupationEntity,
      DocumentChunkEntity,
      CustomRecordEntity,
    ]),
  ],
  providers: [LineageService],
  exports: [LineageService, TypeOrmModule],
})
export class LineageModule {}
