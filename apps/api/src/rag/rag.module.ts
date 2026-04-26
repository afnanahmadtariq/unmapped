import { Module } from '@nestjs/common';
import { EscoModule } from '../taxonomies/esco/esco.module';
import { RetrievalService } from './retrieval.service';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';

@Module({
  imports: [EscoModule],
  controllers: [RagController],
  providers: [RetrievalService, RagService],
  exports: [RetrievalService, RagService],
})
export class RagModule {}
