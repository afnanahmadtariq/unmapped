// UNMAPPED — typed fetch wrapper for the NestJS API.
// All server-side logic now lives in apps/api. The web layer just
// posts JSON and renders the response. Configure NEXT_PUBLIC_API_URL
// in apps/web/.env (defaults to http://localhost:3001).
//
// Payload shapes are kept identical to the deleted /api/* routes so
// callers only swap URL → apiClient method, no body changes.

import type {
  CountryCode,
  CountryConfig,
  Demographics,
  MatchedOccupation,
  Opportunity,
  ProfileContext,
  SkillEvidence,
  SkillsProfile,
} from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res, path);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  return parseResponse<T>(res, path);
}

async function parseResponse<T>(res: Response, path: string): Promise<T> {
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const msg =
      (parsed as any)?.error ||
      (parsed as any)?.message ||
      `Request to ${path} failed (${res.status})`;
    throw new ApiError(res.status, msg, parsed);
  }
  return parsed as T;
}

// ---------- Extract types (kept identical to legacy /api/extract-skills) ----------

export interface ExtractInput {
  countryCode: CountryCode;
  educationLevel: string;
  languages: string[];
  yearsExperience: number;
  story: string;
  declaredSkills: string[];
  demographics?: Demographics;
  context?: ProfileContext;
}

export interface ClarifyingQuestionOption {
  value: string;
  label: string;
}

export interface ClarifyingQuestion {
  id: string;
  prompt: string;
  options: ClarifyingQuestionOption[];
  allowOther?: boolean;
}

export type ExtractTurnResult =
  | { kind: "profile"; profile: SkillsProfile }
  | { kind: "clarify"; reason: string; questions: ClarifyingQuestion[] };

export interface ExtractInitialResponse {
  result: ExtractTurnResult;
  history: unknown[];
  lastAssistant: unknown[];
  baseInput: unknown;
}

export interface ExtractFollowUpResponse {
  result: ExtractTurnResult;
  history: unknown[];
  lastAssistant: unknown[];
  baseInput: unknown;
}

// ---------- Match / opportunities / jobs / email / health ----------

export interface ResilienceBreakdown {
  total: number;
  band: "low" | "medium" | "high" | "very-high";
  diversity: number;
  durability: number;
  momentum: number;
  adjacency: number;
  notes: string[];
}

export interface MatchResponse {
  matches: MatchedOccupation[];
  resilience: ResilienceBreakdown;
}

export interface OpportunityPathwaysInput {
  occupationTitle: string;
  iscoCode?: string;
  countryCode: CountryCode;
  matchedSkills?: string[];
}

export interface JobHit {
  title: string;
  url: string;
  snippet: string;
}

export interface DataStatusResponse {
  esco: "live" | "snapshot";
  worldBank: "live" | "snapshot";
  postgres: "live" | "down";
  milvus: "live" | "down";
  ilostat: "snapshot";
  freyOsborne: "snapshot";
  checkedAt: string;
}

export const apiClient = {
  /** POST /profile/extract — initial turn (mirrors legacy /api/extract-skills initial). */
  extractInitial: (input: ExtractInput) =>
    postJson<ExtractInitialResponse>("/profile/extract", input),

  /** POST /profile/extract/follow-up — continuation after clarifying answers. */
  extractFollowUp: (input: {
    history: unknown[];
    lastAssistant: unknown[];
    answers: Record<string, string>;
    baseInput: unknown;
  }) =>
    postJson<ExtractFollowUpResponse>("/profile/extract/follow-up", input),

  /** POST /profile/match — returns ranked occupations + resilience score. */
  matchOccupations: (input: {
    profile: SkillsProfile;
    countryCode: CountryCode;
  }) => postJson<MatchResponse>("/profile/match", input),

  /** POST /profile/opportunities — Anthropic 4-pathways generator. */
  opportunityPathways: (input: OpportunityPathwaysInput) =>
    postJson<{ opportunities: Opportunity[] }>(
      "/profile/opportunities",
      input,
    ),

  /** POST /jobs/search — Tavily live job-listing search. */
  findJobs: (input: { title: string; countryCode: CountryCode }) =>
    postJson<{ jobs: JobHit[] }>("/jobs/search", input),

  /** POST /notifications/email-profile — emails the portable profile URL. */
  emailProfileLink: (input: {
    email: string;
    url: string;
    countryName?: string;
    skillCount?: number;
  }) =>
    postJson<{
      sent: boolean;
      provider: "smtp" | "none";
      id?: string;
      reason?: string;
      error?: string;
    }>("/notifications/email-profile", input),

  /** GET /health/data-status — per-source freshness probe. */
  dataStatus: () => getJson<DataStatusResponse>("/health/data-status"),

  /** GET /countries — full registry (replaces public/data/countries.json). */
  countries: () => getJson<CountryConfig[]>("/countries"),

  /** GET /countries/:code — single country lookup. */
  country: (code: string) => getJson<CountryConfig>(`/countries/${code}`),
};

export { API_BASE, ApiError };
export type {
  SkillEvidence,
  SkillsProfile,
  MatchedOccupation,
  Opportunity,
};
