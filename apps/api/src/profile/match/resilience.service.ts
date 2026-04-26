import { Injectable } from '@nestjs/common';
import { EscoService } from '../../taxonomies/esco/esco.service';
import { MatchService } from './match.service';
import type {
  CountryCode,
  MatchedOccupation,
  ResilienceBreakdown,
  SkillsProfile,
} from '../../shared/types';

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/**
 * Port of apps/web/lib/resilience.ts. Composite 0-100 score from four equal
 * sub-scores: skill diversity, AI durability, sector momentum, skill adjacency.
 */
@Injectable()
export class ResilienceService {
  constructor(
    private readonly esco: EscoService,
    private readonly match: MatchService,
  ) {}

  async compute(
    profile: SkillsProfile,
    countryCode: CountryCode,
    matchesIn?: MatchedOccupation[],
  ): Promise<ResilienceBreakdown> {
    const matches = (
      matchesIn ?? (await this.match.matchOccupations(profile, countryCode, 5))
    ).slice(0, 3);

    // 1. Diversity (0-25): distinct ESCO categories
    const codes = profile.skills.map((s) => s.escoCode);
    const escoRows = await this.esco.findManyByCodes(codes);
    const cats = new Set(escoRows.map((r) => r.category));
    const diversityRaw = clamp(cats.size / 4);
    const diversity = Math.round(diversityRaw * 25);

    // 2. Durability (0-25): inverse of avg calibrated AI risk
    const avgRisk = matches.length
      ? matches.reduce((a, m) => a + m.automationRiskCalibrated, 0) /
        matches.length
      : 0.5;
    const durability = Math.round((1 - avgRisk) * 25);

    // 3. Momentum (0-25): avg sector growth, clamped to [-5%, 15%]
    const avgGrowth = matches.length
      ? matches.reduce((a, m) => a + m.sectorGrowthYoY, 0) / matches.length
      : 0;
    const momentumRaw = clamp((avgGrowth + 5) / 20);
    const momentum = Math.round(momentumRaw * 25);

    // 4. Adjacency (0-25): fewer missing skills = better fit
    const avgMissing = matches.length
      ? matches.reduce((a, m) => a + m.missingSkills.length, 0) / matches.length
      : 3;
    const adjacencyRaw = clamp(1 - avgMissing / 3);
    const adjacency = Math.round(adjacencyRaw * 25);

    const total = diversity + durability + momentum + adjacency;
    const band: ResilienceBreakdown['band'] =
      total < 35
        ? 'low'
        : total < 55
          ? 'medium'
          : total < 75
            ? 'high'
            : 'very-high';

    const notes: string[] = [];
    if (cats.size < 2)
      notes.push(
        'Add skills outside your current category to increase diversity.',
      );
    if (avgRisk > 0.6)
      notes.push(
        'Top matches lean automation-exposed; consider a durable adjacent role.',
      );
    if (avgGrowth < 1)
      notes.push(
        'Sectors of best fit are stagnating; explore growing sectors nearby.',
      );
    if (avgMissing >= 2)
      notes.push('Several adjacent skills would unlock better matches.');

    return { total, band, diversity, durability, momentum, adjacency, notes };
  }
}
