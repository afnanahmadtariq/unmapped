import { Global, Module } from '@nestjs/common';
import { CountryModule } from '../country/country.module';
import { EscoApiClient } from './esco-api.client';
import { WorldBankApiClient } from './world-bank.client';
import { WittgensteinClient } from './wittgenstein.client';
import { TavilyClient } from './tavily.client';

@Global()
@Module({
  imports: [CountryModule],
  providers: [EscoApiClient, WorldBankApiClient, WittgensteinClient, TavilyClient],
  exports: [EscoApiClient, WorldBankApiClient, WittgensteinClient, TavilyClient],
})
export class ExternalModule {}
