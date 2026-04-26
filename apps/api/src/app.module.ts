import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { EnvModule } from './infra/config/env.module';
import { DatabaseModule } from './infra/database/database.module';
import { VectorModule } from './infra/vector/vector.module';
import { AnthropicModule } from './infra/anthropic/anthropic.module';
import { EmbeddingsModule } from './infra/embeddings/embeddings.module';

import { CountryModule } from './country/country.module';
import { TaxonomiesModule } from './taxonomies/taxonomies.module';
import { SignalsModule } from './signals/signals.module';
import { ExternalModule } from './external/external.module';
import { RagModule } from './rag/rag.module';
import { ProfileModule } from './profile/profile.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';

import { HarvestModule } from './harvest/harvest.module';
import { StorageModule } from './storage/storage.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminModule } from './admin/admin.module';
import { DataController } from './data.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/api/.env'],
    }),
    EnvModule,
    DatabaseModule,
    VectorModule,
    AnthropicModule,
    EmbeddingsModule,

    CountryModule,
    TaxonomiesModule,
    SignalsModule,
    ExternalModule,
    RagModule,
    ProfileModule,
    JobsModule,
    NotificationsModule,
    HealthModule,

    ScheduleModule.forRoot(),
    StorageModule,
    HarvestModule,
    DashboardModule,
    AdminModule,
  ],
  controllers: [DataController],
})
export class AppModule {}
