import { Module } from '@nestjs/common';
import { ExtractModule } from './extract/extract.module';
import { MatchModule } from './match/match.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';

@Module({
  imports: [ExtractModule, MatchModule, OpportunitiesModule],
  exports: [ExtractModule, MatchModule, OpportunitiesModule],
})
export class ProfileModule {}
