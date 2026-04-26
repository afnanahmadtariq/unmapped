import { Module } from '@nestjs/common';
import { EscoModule } from '../../taxonomies/esco/esco.module';
import { RagModule } from '../../rag/rag.module';
import { ExtractController } from './extract.controller';
import { ExtractService } from './extract.service';

@Module({
  imports: [EscoModule, RagModule],
  controllers: [ExtractController],
  providers: [ExtractService],
  exports: [ExtractService],
})
export class ExtractModule {}
