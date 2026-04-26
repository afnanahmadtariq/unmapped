import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HarvestModule } from './harvest/harvest.module';
import { StorageModule } from './storage/storage.module';
import { DataController } from './data.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    StorageModule,
    HarvestModule,
  ],
  controllers: [DataController],
})
export class AppModule {}
