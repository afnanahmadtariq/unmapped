export interface SectorRisk {
  sectorId: string;
  occupations: string[];
  rawAvg: number;
  calibrated: number;
}

export interface WittgensteinShares {
  noEdu: number;
  primary: number;
  lowerSec: number;
  upperSec: number;
  tertiary: number;
}

export interface WittgensteinPoint {
  year: 2025 | 2030 | 2035;
  shares: WittgensteinShares;
}

export interface DashboardSnapshot {
  countryCode: string;
  countryName: string;
  currency: string;
  currencySymbol: string;
  context: string;
  youthUnemploymentRate: number;
  youthUnemploymentSource: string;
  youthUnemploymentYear: number;
  gdpPerCapita: number | null;
  gdpPerCapitaSource: string;
  internetUsersPct: number | null;
  informalEmploymentShare: number;
  minimumWage: number;
  growthBySector: Record<string, number>;
  wagesByISCO: Record<string, number>;
  occupationLookup: Record<string, { title: string; sectorId: string }>;
  automationCalibration: { multiplier: number; rationale: string };
  sectorRisks: SectorRisk[];
  wittgensteinProjections: WittgensteinPoint[] | null;
}
