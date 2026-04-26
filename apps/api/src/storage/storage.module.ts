import { Module, forwardRef } from '@nestjs/common';
import { StorageService } from './storage.service';
import { PostgresLoader } from './postgres.loader';
import { VectorLoader } from './vector.loader';
import { SignalsModule } from '../signals/signals.module';
import { TaxonomiesModule } from '../taxonomies/taxonomies.module';

@Module({
  imports: [
    forwardRef(() => SignalsModule),
    forwardRef(() => TaxonomiesModule),
  ],
  providers: [StorageService, PostgresLoader, VectorLoader],
  exports: [StorageService, PostgresLoader, VectorLoader],
})
export class StorageModule {}
