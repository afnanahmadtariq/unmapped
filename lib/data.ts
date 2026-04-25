// UNMAPPED - server-side data loader. Reads country-scoped JSON snapshots.
// Drop-in design: a new country = a new folder under /public/data + an entry in lib/config.ts.

import escoData from "@/public/data/esco-skills.json";
import iscoData from "@/public/data/isco-occupations.json";
import freyData from "@/public/data/frey-osborne.json";
import ghWages from "@/public/data/ghana/wages.json";
import ghGrowth from "@/public/data/ghana/growth.json";
import ghCalibration from "@/public/data/ghana/calibration.json";
import ghCredentials from "@/public/data/ghana/credentials.json";
import bdWages from "@/public/data/bangladesh/wages.json";
import bdGrowth from "@/public/data/bangladesh/growth.json";
import bdCalibration from "@/public/data/bangladesh/calibration.json";
import bdCredentials from "@/public/data/bangladesh/credentials.json";
import type { CountryCode } from "@/types";

export type EscoSkill = (typeof escoData.skills)[number];
export type IscoOccupation = (typeof iscoData.occupations)[number];

export const ESCO_SKILLS: EscoSkill[] = escoData.skills;
export const ISCO_OCCUPATIONS: IscoOccupation[] = iscoData.occupations;
export const FREY_OSBORNE: Record<string, number> = freyData.scores;

export const ESCO_BY_CODE = new Map(ESCO_SKILLS.map((s) => [s.code, s]));
export const ISCO_BY_CODE = new Map(ISCO_OCCUPATIONS.map((o) => [o.code, o]));

export interface CountryDataset {
  wages: typeof ghWages;
  growth: typeof ghGrowth;
  calibration: typeof ghCalibration;
  credentials: typeof ghCredentials;
}

export function getCountryData(code: CountryCode): CountryDataset {
  if (code === "BD") {
    return {
      wages: bdWages,
      growth: bdGrowth,
      calibration: bdCalibration,
      credentials: bdCredentials,
    };
  }
  return {
    wages: ghWages,
    growth: ghGrowth,
    calibration: ghCalibration,
    credentials: ghCredentials,
  };
}
