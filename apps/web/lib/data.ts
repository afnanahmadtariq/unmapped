// UNMAPPED - server-side data loader.
// Adding a new country = adding an entry to /public/data/countries.json.
// If a hand-curated snapshot exists at /public/data/<code>/, it is used;
// otherwise the system synthesises a baseline from registry + (optionally)
// live World Bank data so any ISO country still works.

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
import keWages from "@/public/data/kenya/wages.json";
import keGrowth from "@/public/data/kenya/growth.json";
import keCalibration from "@/public/data/kenya/calibration.json";
import keCredentials from "@/public/data/kenya/credentials.json";
import { getCountry } from "@/lib/config";
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

const SNAPSHOTS: Record<string, CountryDataset> = {
  GH: { wages: ghWages, growth: ghGrowth, calibration: ghCalibration, credentials: ghCredentials },
  BD: { wages: bdWages, growth: bdGrowth, calibration: bdCalibration, credentials: bdCredentials },
  KE: { wages: keWages, growth: keGrowth, calibration: keCalibration, credentials: keCredentials },
};

export function hasCountrySnapshot(code: CountryCode): boolean {
  return !!SNAPSHOTS[code.toUpperCase()];
}

/** Returns the rich snapshot if present, otherwise a synthesised baseline keyed
 *  off the registry config (currency, calibration multiplier). The async
 *  resolver in lib/countryResolver.ts can further hydrate this with live WB. */
export function getCountryData(code: CountryCode): CountryDataset {
  const upper = code.toUpperCase();
  if (SNAPSHOTS[upper]) return SNAPSHOTS[upper];
  return synthesiseDataset(upper);
}

function synthesiseDataset(code: CountryCode): CountryDataset {
  const country = getCountry(code);
  const scale = country.automationCalibration;
  const scaledWages: Record<string, number> = {};
  for (const [iscoCode, gh] of Object.entries(ghWages.wagesByISCO)) {
    scaledWages[iscoCode] = Math.round(gh * (1 + scale * 1.5));
  }
  return {
    wages: {
      _source: `Synthesised baseline (Ghana spread x calibration). Live WB hydration available.`,
      currency: country.currency,
      vintage: "synthesised-2024",
      wagesByISCO: scaledWages as typeof ghWages.wagesByISCO,
      youthMedianWage: Math.round(ghWages.youthMedianWage * (1 + scale * 1.5)),
      minimumWage: Math.round(ghWages.minimumWage * (1 + scale * 1.5)),
    },
    growth: {
      _source: `Synthesised baseline. Live WB sector growth available.`,
      vintage: "synthesised-2024",
      growthBySector: ghGrowth.growthBySector,
      youthUnemploymentRate: ghGrowth.youthUnemploymentRate,
      informalEmploymentShare: ghGrowth.informalEmploymentShare,
    },
    calibration: {
      _source: `Derived from registry: automationCalibration ${country.automationCalibration} (${country.context}).`,
      countryCode: country.code,
      globalMultiplier: country.automationCalibration,
      sectorOverrides: ghCalibration.sectorOverrides,
      rationale: `Default LMIC calibration applied. Snapshot data not yet curated for ${country.name}; live WB hydration runs at request time.`,
    },
    credentials: {
      _source: `Generic ISCED ladder. Country-specific credentials not yet curated for ${country.name}.`,
      countryCode: country.code,
      formalCredentials: [
        { name: "Lower secondary", abbreviation: "LSec", iscedLevel: 2, equivalentTo: "ISCED 2" },
        { name: "Upper secondary", abbreviation: "USec", iscedLevel: 3, equivalentTo: "ISCED 3" },
        { name: "Vocational / TVET", abbreviation: "TVET", iscedLevel: 4, equivalentTo: "ISCED 4" },
        { name: "Short-cycle tertiary", abbreviation: "Dip", iscedLevel: 5, equivalentTo: "ISCED 5" },
        { name: "Bachelor's", abbreviation: "BA", iscedLevel: 6, equivalentTo: "ISCED 6" },
      ],
      vocationalCredentials: [
        { name: "Generic vocational certificate", issuer: "Local TVET authority", iscoMapping: ["7421", "7231", "7411"] },
      ],
    },
  };
}
