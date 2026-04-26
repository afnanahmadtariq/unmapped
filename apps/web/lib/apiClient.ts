// Cartographer — typed fetch wrapper for the NestJS API.
//
// Address resolution:
//   * Browser → always `/api/proxy` (same-origin reverse proxy under
//     apps/web/app/api/proxy/[...path]/route.ts). This keeps the upstream
//     API hostname out of the client bundle, sidesteps CORS, and lets the
//     API URL change at runtime without rebuilding.
//   * Server (RSC, route handlers, etc.) → direct fetch against the
//     upstream URL. Prefer the server-only `API_URL` env var; fall back
//     to `NEXT_PUBLIC_API_URL` for back-compat.
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

function resolveApiBase(): string {
  if (typeof window !== "undefined") return "/api/proxy";
  const raw = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "")
    .replace(/\/$/, "")
    .trim();
  if (!raw) return "http://localhost:4000";
  if (!/^https?:\/\//i.test(raw)) return `https://${raw}`;
  return raw;
}

const API_BASE = resolveApiBase();

/** Public copy of the resolved API base URL — used by direct download links. */
export const apiBase = API_BASE;

class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function postJson<T>(
  path: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });
  return parseResponse<T>(res, path);
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
  });
  return parseResponse<T>(res, path);
}

async function deleteJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    credentials: "include",
    ...init,
  });
  return parseResponse<T>(res, path);
}

async function patchJson<T>(
  path: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });
  return parseResponse<T>(res, path);
}

async function uploadForm<T>(
  path: string,
  form: FormData,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    body: form,
    ...init,
  });
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

// ---------- Dashboard ----------

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
  youthUnemploymentSource: "live-worldbank" | "snapshot";
  youthUnemploymentYear: number;
  gdpPerCapita: number | null;
  gdpPerCapitaSource: "live-worldbank" | "snapshot";
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

// ---------- Admin ----------

export interface SnapshotCountrySummary {
  code: string;
  name: string;
  region: string;
  defaultLocale: string;
  currency: string;
  currencySymbol: string;
  automationCalibration: number;
  context: string;
}

export interface AdminConfigSummary {
  countryCode: string;
  wagesCount: number;
  sectorsCount: number;
  vintage: string;
  calibrationMultiplier: number;
  calibrationOverridesCount: number;
  calibrationRationale: string;
  formalCredentialsCount: number;
  vocationalCredentialsCount: number;
  credentialsSource: string;
  escoCount: number;
  iscoCount: number;
  freyCount: number;
  snapshotCountries: SnapshotCountrySummary[];
}

export interface AdminDataRun {
  id: string;
  dataSourceId: string;
  sourceSlug: string;
  status: "pending" | "ok" | "failed";
  kind: "cron" | "manual" | "upload" | "seed";
  startedAt: string;
  finishedAt: string | null;
  recordCount: number;
  error: string | null;
  archivePath: string | null;
  fileChecksum: string | null;
  filename: string | null;
}

export interface AdminDataSource {
  id: string;
  slug: string;
  displayName: string;
  kind: "harvester" | "upload";
  sourceUrl: string | null;
  cron: string | null;
  category: string | null;
  isActive: boolean;
  note: string | null;
  schemaSpec: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  lastRun: AdminDataRun | null;
  totalRuns: number;
}

export interface AdminAuthStatus {
  enabled: boolean;
}

export interface AdminMe {
  admin: { email: string; role: "admin"; iat?: number; exp?: number };
}

// ---------- End-user auth + saved profiles ----------

export interface UserAuthStatus {
  enabled: boolean;
  signupEnabled: boolean;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

export interface SavedUserProfile {
  id: string;
  userId: string;
  countryCode: string;
  extractInput: Record<string, unknown>;
  skillsProfile: Record<string, unknown>;
  matches: Record<string, unknown> | null;
  opportunities: Record<string, unknown> | null;
  signals: Record<string, unknown> | null;
  iscoCodes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CompetitionOverlap {
  overlap: number;
  total: number;
  sharedCodes: { iscoCode: string; count: number }[];
}

// ---------- Composite signals (A-H) ----------

export interface CompositeSignals {
  countryCode: string;
  iscoCode: string | null;
  generatedAt: string;
  income: {
    wageFloor: number | null;
    wageGrowthYoY: number | null;
    incomeVolatility: number | null;
    informalFormalGap: number | null;
  };
  demand: {
    sectorEmploymentGrowth: number | null;
    vacancyRate: number | null;
    demandSupplyGap: number | null;
  };
  automation: {
    automationRisk: number | null;
    automationRiskRaw: number | null;
    routineRatio: number | null;
    aiExposureIndex: number | null;
    skillDurability: number | null;
  };
  skillsDemand: {
    topDemandedSkills: Array<{ skillCode: string; label: string; count: number }>;
    emergingSkills: Array<{ skillCode: string; label: string; delta: number }>;
    skillScarcityIndex: number | null;
    crossSkillTransferability: number | null;
  };
  regional: {
    urbanRuralGap: number | null;
    broadbandRate: number | null;
    internetRate: number | null;
  };
  education: {
    upperSecondaryShare2030: number | null;
    tertiaryShare2030: number | null;
    educationSpendShareGdp: number | null;
  };
  inequality: {
    genderEmploymentGap: number | null;
    informalShare: number | null;
  };
  stability: {
    sectorVolatilityIndex: number | null;
    seasonalityFlag: boolean;
  };
}

export type RagExplainCitation =
  | {
      source: "esco";
      code: string;
      label: string;
      category: string;
      description: string | null;
      score: number;
    }
  | {
      source: "onet";
      onetCode: string;
      taskId: string;
      statement: string;
      taskType: string;
      iscoCode: string | null;
      score: number;
    }
  | {
      source: "policy_reports" | "training_programs";
      documentId: string;
      chunkIndex: number;
      title: string;
      text: string;
      score: number;
    };

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

  /** GET /dashboard/snapshot/:countryCode — full policy dashboard payload. */
  dashboardSnapshot: (countryCode: string) =>
    getJson<DashboardSnapshot>(`/dashboard/snapshot/${countryCode}`),

  /** GET /admin/config-summary/:countryCode — dataset counts + calibration + snapshot country list. */
  adminConfigSummary: (countryCode: string) =>
    getJson<AdminConfigSummary>(`/admin/config-summary/${countryCode}`),

  /** GET /signals/composite/:country/:iscoCode? — full A–H signal bundle. */
  compositeSignals: (
    country: string,
    iscoCode?: string | null,
    skills: string[] = [],
  ) => {
    const path = iscoCode
      ? `/signals/composite/${country}/${iscoCode}`
      : `/signals/composite/${country}`;
    const qs = skills.length ? `?skills=${encodeURIComponent(skills.join(","))}` : "";
    return getJson<CompositeSignals>(`${path}${qs}`);
  },

  /** POST /rag/explain — narrative layer over ESCO + O*NET + corpora. */
  ragExplain: (input: {
    question: string;
    countryCode?: string;
    iscoCode?: string | null;
    corpora?: Array<"esco" | "onet" | "policy_reports" | "training_programs">;
    topK?: number;
  }) =>
    postJson<{
      answer: string;
      modelUsed: string;
      citations: Array<RagExplainCitation>;
    }>("/rag/explain", input),

  // ---------- Auth ----------

  authStatus: () => getJson<AdminAuthStatus>("/auth/status"),
  authLogin: (email: string, password: string) =>
    postJson<{ ok: boolean; email: string }>("/auth/login", { email, password }),
  authLogout: () => postJson<{ ok: boolean }>("/auth/logout", {}),
  authMe: () => getJson<AdminMe>("/auth/me"),

  // ---------- Admin sources / runs / uploads ----------

  adminListSources: () => getJson<AdminDataSource[]>("/admin/sources"),
  adminCreateSource: (input: {
    slug: string;
    displayName: string;
    kind?: "harvester" | "upload";
    sourceUrl?: string | null;
    cron?: string | null;
    category?: string | null;
    schemaSpec?: Record<string, unknown> | null;
    note?: string | null;
  }) => postJson<{ id: string; slug: string }>("/admin/sources", input),
  adminPatchSource: (
    id: string,
    patch: Partial<{
      displayName: string;
      sourceUrl: string | null;
      cron: string | null;
      category: string | null;
      isActive: boolean;
      note: string | null;
      schemaSpec: Record<string, unknown> | null;
    }>,
  ) => patchJson<{ id: string; slug: string }>(`/admin/sources/${id}`, patch),
  adminDeleteSource: (id: string) =>
    deleteJson<{ deletedRuns: number; deletedRows: number }>(
      `/admin/sources/${id}`,
    ),
  adminListSourceRuns: (id: string, limit = 50) =>
    getJson<AdminDataRun[]>(`/admin/sources/${id}/runs?limit=${limit}`),
  adminTriggerSource: (id: string) =>
    postJson<{ success: boolean; message: string }>(
      `/admin/sources/${id}/runs`,
      {},
    ),
  adminUploadToSource: (
    id: string,
    file: File,
    extras: {
      loader?: "postgres" | "vector";
      category?: string;
      keyFields?: string[];
    } = {},
  ) => {
    const form = new FormData();
    form.append("file", file);
    if (extras.loader) form.append("loader", extras.loader);
    if (extras.category) form.append("category", extras.category);
    if (extras.keyFields && extras.keyFields.length > 0) {
      form.append("keyFields", extras.keyFields.join(","));
    }
    return uploadForm<{
      runId: string;
      persisted: number;
      note?: string;
      format?: "csv" | "json" | "ndjson" | "text";
    }>(`/admin/sources/${id}/uploads`, form);
  },
  adminListRuns: (limit = 50) =>
    getJson<AdminDataRun[]>(`/admin/runs?limit=${limit}`),
  adminDeleteRun: (id: string) =>
    deleteJson<{ deletedRows: number }>(`/admin/runs/${id}`),

  // ---------- End-user auth (optional) ----------

  userAuthStatus: () => getJson<UserAuthStatus>("/auth/user/status"),
  userSignup: (input: {
    email: string;
    password: string;
    displayName?: string;
  }) =>
    postJson<{ ok: boolean; user: PublicUser }>("/auth/user/signup", input),
  userLogin: (email: string, password: string) =>
    postJson<{ ok: boolean; user: PublicUser }>("/auth/user/login", {
      email,
      password,
    }),
  userLogout: () => postJson<{ ok: boolean }>("/auth/user/logout", {}),
  userMe: () => getJson<{ user: PublicUser }>("/auth/user/me"),

  // ---------- Saved profiles ----------

  meListProfiles: () =>
    getJson<{ profiles: SavedUserProfile[] }>("/me/profile"),
  meGetProfile: (countryCode: string) =>
    getJson<{ profile: SavedUserProfile }>(
      `/me/profile/${encodeURIComponent(countryCode)}`,
    ),
  meUpsertProfile: (input: {
    countryCode: string;
    extractInput: Record<string, unknown>;
    skillsProfile: Record<string, unknown>;
    matches?: Record<string, unknown> | null;
    opportunities?: Record<string, unknown> | null;
    signals?: Record<string, unknown> | null;
    iscoCodes?: string[];
  }) =>
    postJson<{ profile: SavedUserProfile }>("/me/profile", input),
  meDeleteProfile: (countryCode: string) =>
    deleteJson<{ deleted: number }>(
      `/me/profile/${encodeURIComponent(countryCode)}`,
    ),
  meCompetition: (countryCode: string) =>
    getJson<CompetitionOverlap>(
      `/me/profile/${encodeURIComponent(countryCode)}/competition`,
    ),
};

export { API_BASE, ApiError };
export type {
  SkillEvidence,
  SkillsProfile,
  MatchedOccupation,
  Opportunity,
};
