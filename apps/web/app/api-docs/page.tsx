import SiteHeader from "@/components/SiteHeader";
import Pill from "@/components/Pill";
import { Code2, Globe2, Sparkles } from "lucide-react";
import { getCountry, DEFAULT_COUNTRY, listCountries } from "@/lib/config";
import { getDictionary, SUPPORTED_LOCALES } from "@/lib/i18n";

interface PageProps {
  searchParams: Promise<{ country?: string; locale?: string }>;
}

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  purpose: string;
  request?: string;
  response: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/data-status",
    purpose: "Probe per-source freshness (live ESCO + WB, snapshots elsewhere).",
    response: `{
  "esco": "live",
  "worldBank": "live",
  "ilostat": "snapshot",
  "freyOsborne": "snapshot",
  "checkedAt": "2026-04-26T12:00:00.000Z"
}`,
  },
  {
    method: "POST",
    path: "/api/extract-skills",
    purpose:
      "Two-tool LLM extraction. Returns either a finalised ESCO-mapped profile or a set of close-ended clarifying questions when input is conflicting or thin.",
    request: `{
  "countryCode": "GH",
  "educationLevel": "Upper secondary (WASSCE / SSC / HSC)",
  "languages": ["English", "Twi"],
  "yearsExperience": 5,
  "story": "I run a phone repair business in Accra...",
  "declaredSkills": ["soldering", "javascript"],
  "demographics": {
    "ageRange": "18_24",
    "gender": "woman",
    "location": "Accra",
    "workMode": "informal"
  }
}`,
    response: `{
  "result": {
    "kind": "profile" | "clarify",
    "profile": { "skills": [...], "...": "..." },
    "questions": [{ "id": "...", "prompt": "...", "options": [...] }]
  },
  "history": [...],
  "baseInput": {...}
}`,
  },
  {
    method: "POST",
    path: "/api/match-occupations",
    purpose:
      "Match a SkillsProfile to ISCO-08 occupations. Surfaces wage (ILOSTAT), sector growth (WDI), LMIC-calibrated AI risk per match, and a 0-100 Resilience Score.",
    request: `{ "profile": {...}, "countryCode": "GH" }`,
    response: `{
  "matches": [{
    "iscoCode": "7421",
    "title": "Electronics mechanics and servicers",
    "fitScore": 0.92,
    "medianWageMonthly": 1800,
    "sectorGrowthYoY": 4.1,
    "automationRiskRaw": 0.65,
    "automationRiskCalibrated": 0.40,
    "matchedSkills": [...],
    "missingSkills": [...],
    "honestExplanation": "..."
  }],
  "resilience": {
    "total": 68,
    "band": "high",
    "diversity": 18,
    "durability": 17,
    "momentum": 14,
    "adjacency": 19,
    "notes": [...]
  }
}`,
  },
  {
    method: "POST",
    path: "/api/opportunity-pathways",
    purpose:
      "Generate exactly 4 reachable pathways for an occupation: formal employment, self-employment, gig work, training. LLM-generated, country-aware.",
    request: `{
  "occupationTitle": "Electronics mechanics and servicers",
  "iscoCode": "7421",
  "countryCode": "GH",
  "matchedSkills": ["Phone repair","Soldering"]
}`,
    response: `{ "opportunities": [{ "id": "...", "type": "formal" | "self-employment" | "gig" | "training", "title": "...", "source": "...", "description": "..." }] }`,
  },
  {
    method: "POST",
    path: "/api/find-jobs",
    purpose:
      "Live job-listing search via Tavily. Country-specific site: hints applied (Jobberman, BrighterMonday, Bdjobs, etc.).",
    request: `{ "title": "Electronics mechanics and servicers", "countryCode": "GH" }`,
    response: `{ "jobs": [{ "title": "...", "url": "...", "snippet": "..." }] }`,
  },
];

export default async function ApiDocsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const country = getCountry(sp.country ?? DEFAULT_COUNTRY);
  const locale = sp.locale ?? country.defaultLocale;
  const t = getDictionary(locale);

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader countryCode={country.code} locale={locale} active="config" t={t} />

      <section className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8">
          <Pill tone="accent">
            <Code2 className="h-3 w-3" />
            Public API
          </Pill>
          <h1 className="mt-3 text-3xl font-semibold text-fg-primary">
            Protocol, not product
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-fg-secondary">
            Every page on UNMAPPED is a thin client over these endpoints. Any
            government, NGO, training provider or employer can plug straight
            into them. All endpoints accept JSON; responses are JSON; no auth
            required for read endpoints, write endpoints accept the same JSON
            you would post from a browser.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Pill tone="positive">
              <Sparkles className="h-3 w-3" /> Live ESCO REST
            </Pill>
            <Pill tone="positive">
              <Sparkles className="h-3 w-3" /> Live World Bank WDI
            </Pill>
            <Pill tone="neutral">
              <Globe2 className="h-3 w-3" /> {listCountries().length} ISO countries
            </Pill>
            <Pill tone="neutral">
              <Globe2 className="h-3 w-3" /> {SUPPORTED_LOCALES.length} UI languages
            </Pill>
          </div>
        </div>

        <div className="space-y-6">
          {ENDPOINTS.map((e) => (
            <article key={e.path} className="rounded-2xl border border-border-default bg-bg-raised p-6 shadow-sm">
              <header className="flex flex-wrap items-center gap-3">
                <span
                  className={
                    e.method === "GET"
                      ? "rounded-md border border-positive/30 bg-positive/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-positive"
                      : "rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-accent"
                  }
                >
                  {e.method}
                </span>
                <code className="font-mono text-sm text-fg-primary">{e.path}</code>
              </header>
              <p className="mt-3 text-sm text-fg-secondary">{e.purpose}</p>

              {e.request && (
                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-widest text-fg-muted">Request</p>
                  <pre className="mt-1 overflow-x-auto rounded-lg border border-border-default bg-bg-base p-3 font-mono text-[11px] text-fg-secondary">
{e.request}
                  </pre>
                </div>
              )}

              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-widest text-fg-muted">Response</p>
                <pre className="mt-1 overflow-x-auto rounded-lg border border-border-default bg-bg-base p-3 font-mono text-[11px] text-fg-secondary">
{e.response}
                </pre>
              </div>

              <details className="mt-4 cursor-pointer">
                <summary className="text-xs text-accent hover:text-accent-strong">
                  curl example
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-lg border border-border-default bg-bg-base p-3 font-mono text-[11px] text-fg-secondary">
{e.method === "GET"
  ? `curl https://your-host${e.path}`
  : `curl -X POST https://your-host${e.path} \\\n  -H 'content-type: application/json' \\\n  -d '${(e.request ?? "{}").replace(/\n\s*/g, " ")}'`}
                </pre>
              </details>
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-fg-muted">
          Schema is the contract. Add a country by dropping a JSON folder. Add a
          language by dropping a locale file. Keep the matchers, the AI risk
          lens and the LLM tools - this is open infrastructure.
        </p>
      </section>
    </main>
  );
}
