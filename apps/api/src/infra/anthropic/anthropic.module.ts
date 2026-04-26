import { Global, Module } from '@nestjs/common';
import { AnthropicClient } from './anthropic.client';

@Global()
@Module({
  providers: [AnthropicClient],
  exports: [AnthropicClient],
})
export class AnthropicModule {}
