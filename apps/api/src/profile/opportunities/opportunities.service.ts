import { Injectable } from '@nestjs/common';
import { AnthropicClient } from '../../infra/anthropic/anthropic.client';
import { CountryService } from '../../country/country.service';
import { SignalsService } from '../../signals/signals.service';
import { OPPORTUNITY_TOOL } from './opportunities.tool';
import type { Opportunity } from '../../shared/types';

interface GenerateInput {
  occupationTitle: string;
  iscoCode?: string;
  countryCode: string;
  matchedSkills?: string[];
}

/**
 * Port of apps/web/app/api/opportunity-pathways/route.ts. Same prompt
 * scaffolding and tool schema; the difference is that wages, growth,
 * youth-unemployment and informal share now come from SignalsService
 * (Postgres) instead of in-memory snapshots.
 */
@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly anthropic: AnthropicClient,
    private readonly countries: CountryService,
    private readonly signals: SignalsService,
  ) {}

  async generate(input: GenerateInput): Promise<Opportunity[]> {
    const country = this.countries.getOrDefault(input.countryCode);
    const snapshot = await this.signals.getCountrySnapshot(country.code);
    const minWageRow = snapshot.wagesByIsco['9313'] ?? 0; // unskilled labour proxy
    const youthUnemployment = await this.signals.getGrowthFor(
      country.code,
      'YOUTH_UNEMPLOYMENT',
    );
    const informalShare = await this.signals.getGrowthFor(
      country.code,
      'INFORMAL_SHARE',
    );

    const prompt = [
      `Country: ${country.name} (${country.context} economy${
        informalShare ? `, informal share ${informalShare}%` : ''
      }${youthUnemployment ? `, youth unemployment ${youthUnemployment}%` : ''})`,
      `Currency: ${snapshot.currency}${minWageRow ? ` (entry-level wage ~${minWageRow}/mo)` : ''}`,
      `Target occupation: ${input.occupationTitle} (ISCO ${input.iscoCode ?? 'n/a'})`,
      `User already has skills in: ${(input.matchedSkills ?? []).join(', ') || '(generalist)'}`,
      '',
      'Generate exactly 4 reachable opportunity pathways - one each of: formal, self-employment, gig, training.',
      'Each must be specific, locally realistic, and actionable within 3 months. Name real local platforms (Jobberman, BrighterMonday, NVTI, Bdjobs, BTEB, SEIP, etc.) where possible. No global fluff.',
    ].join('\n');

    const response = await this.anthropic.raw().messages.create({
      model: this.anthropic.model,
      max_tokens: 1200,
      tools: [OPPORTUNITY_TOOL],
      tool_choice: { type: 'tool', name: OPPORTUNITY_TOOL.name },
      messages: [{ role: 'user', content: prompt }],
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') return [];
    const parsed = toolUse.input as {
      opportunities: Array<Omit<Opportunity, 'id'>>;
    };
    return parsed.opportunities.map((o, i) => ({
      ...o,
      id: `${input.iscoCode ?? 'occ'}-${i}`,
    }));
  }
}
