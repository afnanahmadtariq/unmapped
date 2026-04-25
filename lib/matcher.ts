// UNMAPPED — match an ESCO skills profile to ISCO occupations.
// Strategy: weighted set similarity over the iscoLinks lists each ESCO skill carries.
// Each skill votes for its linked occupations; advanced > intermediate > beginner.

import type { CountryCode, MatchedOccupation, SkillsProfile } from "@/types";
import {
  ESCO_BY_CODE,
  ISCO_BY_CODE,
  ISCO_OCCUPATIONS,
  getCountryData,
} from "@/lib/data";
import { calibrateRisk } from "@/lib/calibration";

const LEVEL_WEIGHT = { beginner: 0.5, intermediate: 0.8, advanced: 1.0 };

export function matchOccupations(
  profile: SkillsProfile,
  countryCode: CountryCode,
  topN = 5
): MatchedOccupation[] {
  const scores = new Map<string, { score: number; matched: string[] }>();

  for (const skill of profile.skills) {
    const esco = ESCO_BY_CODE.get(skill.escoCode);
    if (!esco) continue;
    const weight = LEVEL_WEIGHT[skill.level] ?? 0.6;
    for (const isco of esco.iscoLinks) {
      const cur = scores.get(isco) ?? { score: 0, matched: [] };
      cur.score += weight;
      cur.matched.push(skill.name);
      scores.set(isco, cur);
    }
  }

  // Normalise score by occupation's typical skill demand (cap at 4 votes)
  const ranked = Array.from(scores.entries())
    .map(([isco, v]) => ({ isco, fitScore: Math.min(1, v.score / 3), matched: v.matched }))
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, topN);

  const data = getCountryData(countryCode);

  return ranked.map(({ isco, fitScore, matched }) => {
    const occ = ISCO_BY_CODE.get(isco);
    const wage = data.wages.wagesByISCO[isco as keyof typeof data.wages.wagesByISCO] ?? 0;
    const growth = occ
      ? data.growth.growthBySector[occ.sectorId as keyof typeof data.growth.growthBySector] ?? 0
      : 0;
    const risk = calibrateRisk(isco, countryCode);

    return {
      iscoCode: isco,
      title: occ?.title ?? "Unknown occupation",
      fitScore,
      matchedSkills: matched,
      missingSkills: missingSkillsFor(isco, profile),
      medianWageMonthly: wage,
      sectorGrowthYoY: growth,
      automationRiskRaw: risk.raw,
      automationRiskCalibrated: risk.calibrated,
      honestExplanation: honestExplanation({
        title: occ?.title ?? "this role",
        wage,
        growth,
        risk: risk.calibrated,
        currency: data.wages.currency,
        matched: matched.length,
        missing: missingSkillsFor(isco, profile).length,
      }),
    };
  });
}

function missingSkillsFor(isco: string, profile: SkillsProfile): string[] {
  const userCodes = new Set(profile.skills.map((s) => s.escoCode));
  const desired = ISCO_OCCUPATIONS.find((o) => o.code === isco);
  if (!desired) return [];
  // Skills whose iscoLinks include this occupation but the user does not yet have
  const result: string[] = [];
  for (const esco of ESCO_BY_CODE.values()) {
    if (esco.iscoLinks.includes(isco) && !userCodes.has(esco.code)) {
      result.push(esco.label);
    }
  }
  return result.slice(0, 3);
}

function honestExplanation(p: {
  title: string;
  wage: number;
  growth: number;
  risk: number;
  currency: string;
  matched: number;
  missing: number;
}): string {
  const wageFmt = p.wage > 0 ? `${p.currency} ${p.wage.toLocaleString()}/mo` : "wage data unavailable";
  const growthFmt = p.growth >= 0 ? `+${p.growth.toFixed(1)}%` : `${p.growth.toFixed(1)}%`;
  const riskWord = p.risk < 0.35 ? "low" : p.risk < 0.65 ? "moderate" : "high";
  const gap = p.missing === 0
    ? "Your profile already covers the core skills."
    : `${p.missing} adjacent skill${p.missing > 1 ? "s" : ""} would strengthen your fit.`;
  return `${p.title}: ${wageFmt}, sector growth ${growthFmt} YoY, ${riskWord} AI displacement risk. ${gap}`;
}
