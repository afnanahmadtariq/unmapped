import { Module } from '@nestjs/common';
import { CountryModule } from '../country/country.module';
import { SignalsModule } from '../signals/signals.module';
import { TaxonomiesModule } from '../taxonomies/taxonomies.module';
import { HarvestModule } from '../harvest/harvest.module';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminUploadService } from './admin-upload.service';

@Module({
  imports: [
    CountryModule,
    SignalsModule,
    TaxonomiesModule,
    HarvestModule,
    StorageModule,
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminUploadService],
})
export class AdminModule {}
