import type { CountryCode } from '../shared/types';

export interface CalibratedRisk {
  iscoCode: string;
  raw: number;
  calibrated: number;
  multiplier: number;
  rationale: string;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface CountrySnapshot {
  countryCode: CountryCode;
  currency: string;
  wagesByIsco: Record<string, number>;
  growthBySector: Record<string, number>;
  calibration: {
    globalMultiplier: number;
    sectorOverrides: Record<string, number>;
    rationale: string;
  };
}
