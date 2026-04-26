import { Body, Controller, Post } from '@nestjs/common';
import { MatchService } from './match.service';
import { ResilienceService } from './resilience.service';
import { MatchOccupationsDto } from './match.dto';
import type { SkillsProfile } from '../../shared/types';

@Controller('profile/match')
export class MatchController {
  constructor(
    private readonly match: MatchService,
    private readonly resilience: ResilienceService,
  ) {}

  /**
   * POST /profile/match
   * Replaces the legacy /api/match-occupations route. Returns occupations,
   * the resilience breakdown, and the profile echoed back for caller convenience.
   */
  @Post()
  async run(@Body() body: MatchOccupationsDto) {
    const profile = body.profile as unknown as SkillsProfile;
    const matches = await this.match.matchOccupations(
      profile,
      body.countryCode,
      body.topN ?? 5,
    );
    const resilience = await this.resilience.compute(
      profile,
      body.countryCode,
      matches,
    );
    return { matches, resilience };
  }
}
