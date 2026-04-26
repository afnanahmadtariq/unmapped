// UNMAPPED - LMIC automation calibration.
// The brief explicitly demands per-country calibration ("automation risk looks different in
// Kampala than in Kuala Lumpur"). Raw Frey-Osborne is OECD-baseline and overstates LMIC risk.

import type { CountryCode } from "@/types";
import { FREY_OSBORNE, ISCO_BY_CODE, getCountryData } from "@/lib/data";

export interface CalibratedRisk {
  iscoCode: string;
  raw: number;
  calibrated: number;
  multiplier: number;
  rationale: string;
}

export function calibrateRisk(
  iscoCode: string,
  countryCode: CountryCode
): CalibratedRisk {
  const raw = FREY_OSBORNE[iscoCode] ?? 0.5;
  const occupation = ISCO_BY_CODE.get(iscoCode);
  const cal = getCountryData(countryCode).calibration;
  const sectorOverride =
    occupation && cal.sectorOverrides[occupation.sectorId as keyof typeof cal.sectorOverrides];
  const multiplier = sectorOverride ?? cal.globalMultiplier;
  const calibrated = Math.min(1, Math.max(0, raw * multiplier));
  return {
    iscoCode,
    raw,
    calibrated,
    multiplier,
    rationale: cal.rationale,
  };
}

export type RiskLevel = "low" | "medium" | "high";

export function riskLevel(score: number): RiskLevel {
  if (score < 0.35) return "low";
  if (score < 0.65) return "medium";
  return "high";
}
