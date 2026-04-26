import { Injectable } from '@nestjs/common';
import { EscoService } from '../../taxonomies/esco/esco.service';
import { IscoService } from '../../taxonomies/isco/isco.service';
import { SignalsService } from '../../signals/signals.service';
import type {
  CountryCode,
  MatchedOccupation,
  SkillsProfile,
} from '../../shared/types';

const LEVEL_WEIGHT: Record<string, number> = {
  beginner: 0.5,
  intermediate: 0.8,
  advanced: 1.0,
};

/**
 * Port of apps/web/lib/matcher.ts. Same weighted-set-similarity algorithm,
 * but ESCO and ISCO lookups go through Postgres-backed services instead of
 * in-memory maps, and signals (wage / growth / risk) come from SignalsService.
 */
@Injectable()
export class MatchService {
  constructor(
    private readonly esco: EscoService,
    private readonly isco: IscoService,
    private readonly signals: SignalsService,
  ) {}

  async matchOccupations(
    profile: SkillsProfile,
    countryCode: CountryCode,
    topN = 5,
  ): Promise<MatchedOccupation[]> {
    if (profile.skills.length === 0) return [];

    const escoCodes = profile.skills.map((s) => s.escoCode);
    const escoRows = await this.esco.findManyByCodes(escoCodes);
    const escoByCode = new Map(escoRows.map((r) => [r.code, r]));

    const scores = new Map<string, { score: number; matched: string[] }>();
    for (const skill of profile.skills) {
      const meta = escoByCode.get(skill.escoCode);
      if (!meta) continue;
      const weight = LEVEL_WEIGHT[skill.level] ?? 0.6;
      for (const isco of meta.iscoLinks ?? []) {
        const cur = scores.get(isco) ?? { score: 0, matched: [] };
        cur.score += weight;
        cur.matched.push(skill.name);
        scores.set(isco, cur);
      }
    }

    const ranked = Array.from(scores.entries())
      .map(([isco, v]) => ({
        isco,
        fitScore: Math.min(1, v.score / 3),
        matched: v.matched,
      }))
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, topN);

    if (ranked.length === 0) return [];

    const iscoCodes = ranked.map((r) => r.isco);
    const iscoRows = await this.isco.findManyByCodes(iscoCodes);
    const iscoByCode = new Map(iscoRows.map((r) => [r.code, r]));
    const userCodes = new Set(profile.skills.map((s) => s.escoCode));
    const currency = this.signals.getCurrencyFor(countryCode);

    const out: MatchedOccupation[] = [];
    for (const { isco, fitScore, matched } of ranked) {
      const occ = iscoByCode.get(isco);
      const wage = await this.signals.getWageFor(countryCode, isco);
      const growth = occ?.sectorId
        ? await this.signals.getGrowthFor(countryCode, occ.sectorId)
        : 0;
      const risk = await this.signals.calibrateRisk(isco, countryCode);
      const missing = await this.computeMissingSkills(isco, userCodes);
      out.push({
        iscoCode: isco,
        title: occ?.title ?? 'Unknown occupation',
        fitScore,
        matchedSkills: matched,
        missingSkills: missing,
        medianWageMonthly: wage,
        sectorGrowthYoY: growth,
        automationRiskRaw: risk.raw,
        automationRiskCalibrated: risk.calibrated,
        honestExplanation: this.honestExplanation({
          title: occ?.title ?? 'this role',
          wage,
          growth,
          risk: risk.calibrated,
          currency,
          matched: matched.length,
          missing: missing.length,
        }),
      });
    }
    return out;
  }

  private async computeMissingSkills(
    isco: string,
    userCodes: Set<string>,
  ): Promise<string[]> {
    const linked = await this.esco.findByIscoLink(isco);
    return linked
      .filter((s) => !userCodes.has(s.code))
      .slice(0, 3)
      .map((s) => s.label);
  }

  private honestExplanation(p: {
    title: string;
    wage: number;
    growth: number;
    risk: number;
    currency: string;
    matched: number;
    missing: number;
  }): string {
    const wageFmt =
      p.wage > 0
        ? `${p.currency} ${p.wage.toLocaleString()}/mo`
        : 'wage data unavailable';
    const growthFmt =
      p.growth >= 0 ? `+${p.growth.toFixed(1)}%` : `${p.growth.toFixed(1)}%`;
    const riskWord =
      p.risk < 0.35 ? 'low' : p.risk < 0.65 ? 'moderate' : 'high';
    const gap =
      p.missing === 0
        ? 'Your profile already covers the core skills.'
        : `${p.missing} adjacent skill${
            p.missing > 1 ? 's' : ''
          } would strengthen your fit.`;
    return `${p.title}: ${wageFmt}, sector growth ${growthFmt} YoY, ${riskWord} AI displacement risk. ${gap}`;
  }
}
