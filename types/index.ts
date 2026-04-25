// UNMAPPED - shared type definitions
// All shapes that cross the API boundary live here.

export type CountryCode = "GH" | "BD";
export type LocaleCode = "en" | "fr" | "bn";

export interface CountryConfig {
  code: CountryCode;
  name: string;
  defaultLocale: LocaleCode;
  currency: string;
  currencySymbol: string;
  dataPath: string;
  automationCalibration: number; // multiplier vs raw Frey-Osborne (LMICs differ)
  credentialMapPath: string;
  context: "urban-informal" | "mixed-urban-rural" | "rural-agricultural";
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

export interface SkillsProfile {
  userInputSummary: string;
  countryCode: CountryCode;
  educationLevel: string;
  languages: string[];
  yearsExperience: number;
  demographics?: Demographics;
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
