// Cartographer - shared type definitions
// All shapes that cross the API boundary live here.

// Country code is an ISO 3166-1 alpha-2 string. The supported list is in
// public/data/countries.json. The system gracefully handles ANY ISO code via
// the live World Bank fallback; a few countries have rich curated snapshots.
export type CountryCode = string;

// Locale is BCP-47 language code. Loadable list is in lib/i18n.ts.
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
  context: "urban-informal" | "mixed-urban-rural" | "rural-agricultural";
  /** True if we ship a hand-curated snapshot under /public/data/<code>/ */
  hasSnapshot: boolean;
}

export interface SkillEvidence {
  name: string;
  escoCode: string;
  level: "beginner" | "intermediate" | "advanced";
  evidence: string; // plain-English why-this-skill explanation for the user
  durabilityNote?: string; // adjacent durable skill hint (Module 02 light)
}

export type AgeRange = "u18" | "18_24" | "25_29" | "30_34" | "35plus";
export type Gender = "prefer" | "woman" | "man" | "nonbinary" | "self";
export type WorkMode = "informal" | "formal" | "gig" | "study" | "looking";

export interface Demographics {
  ageRange?: AgeRange;
  gender?: Gender;
  location?: string;
  workMode?: WorkMode;
}

// Optional richer context. The wizard collects this in steps 3-5 but the
// minimum-viable extraction still works without any of it.
export type PhoneAccess = "own" | "shared" | "none";
export type SelfLearningChannel = "youtube" | "apprenticeship" | "work" | "family" | "course";
export type TaskPrimitive =
  | "fixed-built"      // Fixed or built things
  | "customer-talk"    // Talked to customers
  | "managed-money"    // Handled money / accounts
  | "used-tech"        // Used a phone or computer for work
  | "taught-others"    // Taught or supervised others
  | "sold-products";   // Sold products or services
export type ToolUsed = "smartphone" | "computer" | "machinery" | "internet-tools";
export type WorkFrequency = "daily" | "weekly" | "monthly" | "occasional";

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
  fitScore: number; // 0-1
  matchedSkills: string[];
  missingSkills: string[];
  medianWageMonthly: number; // local currency
  sectorGrowthYoY: number; // percent
  automationRiskRaw: number; // raw Frey-Osborne 0-1
  automationRiskCalibrated: number; // after country multiplier
  honestExplanation: string;
}

export type OpportunityType = "formal" | "self-employment" | "gig" | "training";

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

export interface CredentialMapping {
  countryCode: CountryCode;
  formalCredentials: Array<{
    name: string;
    abbreviation: string;
    iscedLevel: number;
    equivalentTo: string;
  }>;
  vocationalCredentials: Array<{
    name: string;
    issuer: string;
    iscoMapping: string[];
  }>;
}

export interface EconometricSnapshot {
  countryCode: CountryCode;
  youthUnemploymentRate: number;
  medianWageBySector: Record<string, number>;
  sectorGrowthYoY: Record<string, number>;
  source: string;
  vintage: string;
}
