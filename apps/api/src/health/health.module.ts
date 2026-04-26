import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { DatasetRunEntity } from '../lineage/dataset-run.entity';
import { DataSourceEntity } from '../lineage/data-source.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DatasetRunEntity, DataSourceEntity])],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
