import { Module } from '@nestjs/common';
import { EscoModule } from './esco/esco.module';
import { IscoModule } from './isco/isco.module';

@Module({
  imports: [EscoModule, IscoModule],
  exports: [EscoModule, IscoModule],
})
export class TaxonomiesModule {}
