import { Module } from '@nestjs/common';
import { EscoModule } from '../../taxonomies/esco/esco.module';
import { IscoModule } from '../../taxonomies/isco/isco.module';
import { SignalsModule } from '../../signals/signals.module';
import { MatchService } from './match.service';
import { ResilienceService } from './resilience.service';
import { MatchController } from './match.controller';

@Module({
  imports: [EscoModule, IscoModule, SignalsModule],
  controllers: [MatchController],
  providers: [MatchService, ResilienceService],
  exports: [MatchService, ResilienceService],
})
export class MatchModule {}
