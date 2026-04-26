import { Global, Module } from '@nestjs/common';
import { MilvusVectorClient } from './milvus.client';

@Global()
@Module({
  providers: [MilvusVectorClient],
  exports: [MilvusVectorClient],
})
export class VectorModule {}
