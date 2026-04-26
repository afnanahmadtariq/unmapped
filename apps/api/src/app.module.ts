import * as path from 'path';
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
      // Resolved relative to this compiled file so it works regardless of
      // which directory the API is launched from (turbo run, nest start,
      // jest, ts-node, etc.). Order: first hit wins.
      //   __dirname when running ts-node:  apps/api/src
      //   __dirname when running compiled: apps/api/dist
      // Both layouts walk up to apps/api/ then to monorepo root.
      envFilePath: [
        // ts-node:                __dirname = apps/api/src
        // nest start --watch:     __dirname = apps/api/dist/src
        // Try every plausible depth so this works in either layout.
        path.resolve(__dirname, '../.env'),            // apps/api/.env (override)
        path.resolve(__dirname, '../../.env'),         // monorepo root from src/
        path.resolve(__dirname, '../../../.env'),      // monorepo root from dist/src/
        path.resolve(__dirname, '../../../../.env'),   // monorepo root from dist/src/<sub>/
        path.resolve(process.cwd(), '.env'),           // fallback to CWD
      ],
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
