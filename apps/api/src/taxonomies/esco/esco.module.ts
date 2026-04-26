import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EscoSkillEntity } from './esco.entity';
import { EscoService } from './esco.service';
import { EscoSearchService } from './esco-search.service';
import { EscoIngestService } from './esco-ingest.service';
import { EscoController } from './esco.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EscoSkillEntity])],
  controllers: [EscoController],
  providers: [EscoService, EscoSearchService, EscoIngestService],
  exports: [EscoService, EscoSearchService, EscoIngestService],
})
export class EscoModule {}
