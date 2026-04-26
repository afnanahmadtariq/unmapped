// UNMAPPED - "Resilience Score" 0-100.
// Composite of four sub-scores, each contributing 25 points:
//   1. Diversity:   how many distinct ESCO categories the user spans
//   2. AI durability: 1 - average calibrated automation risk over best 3 matches
//   3. Sector momentum: avg sector growth across best 3 matches (clamped)
//   4. Adjacency:   inverse of mean missing-skills count across best 3 matches
//
// The point isn't precision - it's giving the user one number they remember.
// The breakdown is shown so the reasoning is explainable, not magical.

import type { CountryCode, MatchedOccupation, SkillsProfile } from "@/types";
import { ESCO_BY_CODE } from "@/lib/data";
import { matchOccupations } from "@/lib/matcher";

export interface ResilienceBreakdown {
  total: number;
  band: "low" | "medium" | "high" | "very-high";
  diversity: number;
  durability: number;
  momentum: number;
  adjacency: number;
  notes: string[];
}

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

export function computeResilience(
  profile: SkillsProfile,
  countryCode: CountryCode,
  matchesIn?: MatchedOccupation[]
): ResilienceBreakdown {
  const matches = (matchesIn ?? matchOccupations(profile, countryCode, 5)).slice(0, 3);

  // 1. Diversity (0-25): distinct ESCO categories
  const cats = new Set<string>();
  for (const s of profile.skills) {
    const meta = ESCO_BY_CODE.get(s.escoCode);
    if (meta) cats.add(meta.category);
  }
  const diversityRaw = clamp(cats.size / 4); // 4+ categories = full marks
  const diversity = Math.round(diversityRaw * 25);

  // 2. Durability (0-25): inverse of avg calibrated AI risk
  const avgRisk = matches.length
    ? matches.reduce((a, m) => a + m.automationRiskCalibrated, 0) / matches.length
    : 0.5;
  const durability = Math.round((1 - avgRisk) * 25);

  // 3. Momentum (0-25): avg sector growth, clamped to [-5%, 15%]
  const avgGrowth = matches.length
    ? matches.reduce((a, m) => a + m.sectorGrowthYoY, 0) / matches.length
    : 0;
  const momentumRaw = clamp((avgGrowth + 5) / 20);
  const momentum = Math.round(momentumRaw * 25);

  // 4. Adjacency (0-25): fewer missing skills = better fit, higher score
  const avgMissing = matches.length
    ? matches.reduce((a, m) => a + m.missingSkills.length, 0) / matches.length
    : 3;
  const adjacencyRaw = clamp(1 - avgMissing / 3);
  const adjacency = Math.round(adjacencyRaw * 25);

  const total = diversity + durability + momentum + adjacency;
  const band: ResilienceBreakdown["band"] =
    total < 35 ? "low" : total < 55 ? "medium" : total < 75 ? "high" : "very-high";

  const notes: string[] = [];
  if (cats.size < 2) notes.push("Add skills outside your current category to increase diversity.");
  if (avgRisk > 0.6) notes.push("Top matches lean automation-exposed; consider a durable adjacent role.");
  if (avgGrowth < 1) notes.push("Sectors of best fit are stagnating; explore growing sectors nearby.");
  if (avgMissing >= 2) notes.push("Several adjacent skills would unlock better matches.");

  return { total, band, diversity, durability, momentum, adjacency, notes };
}
