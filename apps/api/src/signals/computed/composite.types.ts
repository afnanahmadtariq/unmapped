/**
 * Full A–H signal catalogue surfaced by `GET /signals/composite/:country/:isco?`.
 * Every field is optional / nullable because data availability varies by
 * country and harvester freshness; the UI is expected to render gracefully
 * when a value is `null`.
 */

export interface IncomeSignals {
  /** A. 10th-percentile wage (currency = country.currency). */
  wageFloor: number | null;
  /** A. Year-over-year wage change in percent. */
  wageGrowthYoY: number | null;
  /** A. Stddev of wage levels across the last 5 years. */
  incomeVolatility: number | null;
  /** A. Informal vs formal wage gap, expressed as ratio (formal=1). */
  informalFormalGap: number | null;
}

export interface DemandSignals {
  /** B. Sector-level employment growth in percent (yoy). */
  sectorEmploymentGrowth: number | null;
  /** B. Live job listings count from Tavily for this title/country. */
  vacancyRate: number | null;
  /** B. vacancyRate − graduateRate. Negative = oversupply. */
  demandSupplyGap: number | null;
}

export interface AutomationSignals {
  /** C. Calibrated Frey-Osborne automation probability (0–1). */
  automationRisk: number | null;
  /** C. Frey-Osborne raw probability (0–1). */
  automationRiskRaw: number | null;
  /** C. ILO-FoW routine task index (0–1). */
  routineRatio: number | null;
  /** C. ILO-FoW AI exposure index (0–1). */
  aiExposureIndex: number | null;
  /** C. 1 − weighted avg risk on declared skills (0–1). */
  skillDurability: number | null;
}

export interface SkillsDemandSignals {
  /** D. Top demanded skills by frequency in live job snippets. */
  topDemandedSkills: Array<{ skillCode: string; label: string; count: number }>;
  /** D. Skills whose mention-frequency rose vs 12 months ago. */
  emergingSkills: Array<{ skillCode: string; label: string; delta: number }>;
  /** D. Inverse of education-projection share for the relevant cohort. */
  skillScarcityIndex: number | null;
  /** D. Cross-skill transferability (graph degree in ESCO→ISCO). */
  crossSkillTransferability: number | null;
}

export interface RegionalSignals {
  /** E. WDI urban-rural gap on internet usage (%). */
  urbanRuralGap: number | null;
  /** E. Country-level fixed broadband subscription rate (%). */
  broadbandRate: number | null;
  /** E. Country-level individuals using internet (%). */
  internetRate: number | null;
}

export interface EducationSignals {
  /** F. Share with at least upper-secondary education in 2030 (0–1). */
  upperSecondaryShare2030: number | null;
  /** F. Share with tertiary education in 2030 (0–1). */
  tertiaryShare2030: number | null;
  /** F. Public expenditure on education (% of GDP). */
  educationSpendShareGdp: number | null;
}

export interface InequalitySignals {
  /** G. Female employment rate − male employment rate. */
  genderEmploymentGap: number | null;
  /** G. Informal employment share (0–1). */
  informalShare: number | null;
}

export interface StabilitySignals {
  /** H. Rolling stddev of sector growth (%). */
  sectorVolatilityIndex: number | null;
  /** H. Heuristic seasonality flag for agricultural sectors. */
  seasonalityFlag: boolean;
}

export interface CompositeSignals {
  countryCode: string;
  iscoCode: string | null;
  generatedAt: string;
  income: IncomeSignals;
  demand: DemandSignals;
  automation: AutomationSignals;
  skillsDemand: SkillsDemandSignals;
  regional: RegionalSignals;
  education: EducationSignals;
  inequality: InequalitySignals;
  stability: StabilitySignals;
}
