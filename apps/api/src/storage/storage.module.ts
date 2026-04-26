import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageService } from './storage.service';
import { PostgresLoader } from './postgres.loader';
import { VectorLoader } from './vector.loader';
import { CustomRecordEntity } from './custom-record.entity';
import { CustomRecordsService } from './custom-records.service';
import { CustomDocumentsService } from './custom-documents.service';
import { SignalsModule } from '../signals/signals.module';
import { TaxonomiesModule } from '../taxonomies/taxonomies.module';
import { CorporaModule } from '../corpora/corpora.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomRecordEntity]),
    forwardRef(() => SignalsModule),
    forwardRef(() => TaxonomiesModule),
    CorporaModule,
  ],
  providers: [
    StorageService,
    PostgresLoader,
    VectorLoader,
    CustomRecordsService,
    CustomDocumentsService,
  ],
  exports: [
    StorageService,
    PostgresLoader,
    VectorLoader,
    CustomRecordsService,
    CustomDocumentsService,
    TypeOrmModule,
  ],
})
export class StorageModule {}
