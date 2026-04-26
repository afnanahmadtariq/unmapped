/**
 * Shared cross-module types. Mirrors apps/web/types/index.ts so that the
 * web client and the API speak exactly the same shapes over JSON.
 */

export type CountryCode = string;
export type LocaleCode = string;

export interface CountryConfig {
  code: CountryCode;
  iso3: string;
  name: string;
  region: string;
  defaultLocale: LocaleCode;
  currency: string;
  currencySymbol: string;
  automationCalibration: number;
  context: 'urban-informal' | 'mixed-urban-rural' | 'rural-agricultural';
  /** True if a hand-curated snapshot exists for this country. */
  hasSnapshot: boolean;
}

export interface SkillEvidence {
  name: string;
  escoCode: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  evidence: string;
  durabilityNote?: string;
}

export type AgeRange = 'u18' | '18_24' | '25_29' | '30_34' | '35plus';
export type Gender = 'prefer' | 'woman' | 'man' | 'nonbinary' | 'self';
export type WorkMode = 'informal' | 'formal' | 'gig' | 'study' | 'looking';

export interface Demographics {
  ageRange?: AgeRange;
  gender?: Gender;
  location?: string;
  workMode?: WorkMode;
}

export type PhoneAccess = 'own' | 'shared' | 'none';
export type SelfLearningChannel =
  | 'youtube'
  | 'apprenticeship'
  | 'work'
  | 'family'
  | 'course';
export type TaskPrimitive =
  | 'fixed-built'
  | 'customer-talk'
  | 'managed-money'
  | 'used-tech'
  | 'taught-others'
  | 'sold-products';
export type ToolUsed =
  | 'smartphone'
  | 'computer'
  | 'machinery'
  | 'internet-tools';
export type WorkFrequency = 'daily' | 'weekly' | 'monthly' | 'occasional';

export interface WorkEntry {
  activity: string;
  years: number;
  frequency: WorkFrequency;
  paid: boolean;
}

export interface Constraints {
  maxTravelKm?: number;
  needIncomeNow?: boolean;
  canStudy?: boolean;
  hasInternet?: boolean;
}

export interface ProfileContext {
  phoneAccess?: PhoneAccess;
  selfLearning?: SelfLearningChannel[];
  workEntries?: WorkEntry[];
  tasks?: TaskPrimitive[];
  tools?: ToolUsed[];
  constraints?: Constraints;
  aspirations?: string;
}

export interface SkillsProfile {
  userInputSummary: string;
  countryCode: CountryCode;
  educationLevel: string;
  languages: string[];
  yearsExperience: number;
  demographics?: Demographics;
  context?: ProfileContext;
  skills: SkillEvidence[];
  generatedAt: string;
}

export interface MatchedOccupation {
  iscoCode: string;
  title: string;
  fitScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  medianWageMonthly: number;
  sectorGrowthYoY: number;
  automationRiskRaw: number;
  automationRiskCalibrated: number;
  honestExplanation: string;
}

export type OpportunityType = 'formal' | 'self-employment' | 'gig' | 'training';

export interface Opportunity {
  id: string;
  type: OpportunityType;
  title: string;
  source: string;
  url?: string;
  estimatedEarning?: string;
  timeToReadiness?: string;
  description: string;
}

export interface ResilienceBreakdown {
  total: number;
  band: 'low' | 'medium' | 'high' | 'very-high';
  diversity: number;
  durability: number;
  momentum: number;
  adjacency: number;
  notes: string[];
}
