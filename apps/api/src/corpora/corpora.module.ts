import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentChunkEntity } from './document-chunk.entity';
import { CorporaIngestService } from './corpora-ingest.service';
import { CorporaSearchService } from './corpora-search.service';

/**
 * Module for the auxiliary RAG corpora (`policy_reports`,
 * `training_programs`). Owns the `document_chunks` Postgres table and
 * exposes ingest + search services that mirror the ESCO / O*NET pattern.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DocumentChunkEntity])],
  providers: [CorporaIngestService, CorporaSearchService],
  exports: [CorporaIngestService, CorporaSearchService, TypeOrmModule],
})
export class CorporaModule {}
