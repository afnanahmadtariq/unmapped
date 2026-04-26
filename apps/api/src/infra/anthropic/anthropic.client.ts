import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { EnvService } from '../config/env.service';

/**
 * Single Anthropic client shared across the app — replaces the per-route
 * `_client` singletons that lived in apps/web/lib/llm.ts and the
 * opportunity-pathways route.
 */
@Injectable()
export class AnthropicClient {
  private readonly _client: Anthropic;
  private readonly _model: string;

  constructor(env: EnvService) {
    this._client = new Anthropic({ apiKey: env.get('ANTHROPIC_API_KEY') });
    this._model = env.get('ANTHROPIC_MODEL');
  }

  raw(): Anthropic {
    return this._client;
  }

  get model(): string {
    return this._model;
  }
}
