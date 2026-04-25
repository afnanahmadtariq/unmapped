"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Briefcase,
  GraduationCap,
  Sparkles,
  TrendingUp,
  UserRound,
  Wallet,
  ShieldAlert,
  Loader2,
  Info,
} from "lucide-react";
import clsx from "clsx";
import Pill from "@/components/Pill";
import type {
  CountryCode,
  MatchedOccupation,
  Opportunity,
  OpportunityType,
  SkillsProfile,
} from "@/types";

interface Props {
  countryCode: CountryCode;
  countryName: string;
  currency: string;
  currencySymbol: string;
  locale: string;
  profileHref: string;
}

interface JobHit {
  title: string;
  url: string;
  snippet: string;
}

const TYPE_ICON: Record<OpportunityType, React.ReactNode> = {
  formal: <Briefcase className="h-3.5 w-3.5" />,
  "self-employment": <UserRound className="h-3.5 w-3.5" />,
  gig: <Sparkles className="h-3.5 w-3.5" />,
  training: <GraduationCap className="h-3.5 w-3.5" />,
};

const TYPE_LABEL: Record<OpportunityType, string> = {
  formal: "Formal employment",
  "self-employment": "Self-employment",
  gig: "Gig work",
  training: "Training pathway",
};

export default function OpportunityWorkbench({
  countryCode,
  countryName,
  currency,
  currencySymbol,
  locale,
  profileHref,
}: Props) {
  const [profile, setProfile] = useState<SkillsProfile | null>(null);
  const [matches, setMatches] = useState<MatchedOccupation[] | null>(null);
  const [activeIsco, setActiveIsco] = useState<string | null>(null);
  const [pathways, setPathways] = useState<Record<string, Opportunity[]>>({});
  const [jobs, setJobs] = useState<Record<string, JobHit[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pull profile from sessionStorage (set on /profile after extraction)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(`unmapped:profile:${countryCode}`);
    if (raw) {
      try {
        setProfile(JSON.parse(raw));
      } catch {
        // ignore
      }
    }
  }, [countryCode]);

  // When profile is available, request matches
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/match-occupations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile, countryCode }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { matches: MatchedOccupation[] };
        if (cancelled) return;
        setMatches(data.matches);
        if (data.matches[0]) setActiveIsco(data.matches[0].iscoCode);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, countryCode]);

  // When activeIsco changes, fetch its pathways + jobs (cached per code)
  useEffect(() => {
    if (!activeIsco || !matches) return;
    const occupation = matches.find((m) => m.iscoCode === activeIsco);
    if (!occupation) return;

    if (!pathways[activeIsco]) {
      fetch("/api/opportunity-pathways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occupationTitle: occupation.title,
          iscoCode: activeIsco,
          countryCode,
          matchedSkills: occupation.matchedSkills,
        }),
      })
        .then((r) => r.json())
        .then((d) =>
          setPathways((prev) => ({ ...prev, [activeIsco]: d.opportunities ?? [] }))
        )
        .catch(() => undefined);
    }
    if (!jobs[activeIsco]) {
      fetch("/api/find-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: occupation.title, countryCode }),
      })
        .then((r) => r.json())
        .then((d) => setJobs((prev) => ({ ...prev, [activeIsco]: d.jobs ?? [] })))
        .catch(() => undefined);
    }
  }, [activeIsco, matches, pathways, jobs, countryCode]);

  if (!profile) {
    return (
      <EmptyState
        title="No skills profile yet"
        body="Map your skills first — your opportunities are generated against your profile."
        cta={{ href: profileHref, label: "Map My Skills" }}
      />
    );
  }

  if (loading) {
    return (
      <EmptyState
        title="Matching opportunities"
        body="Computing fit scores against ISCO-08 occupations and your local labour market."
        loading
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Something went wrong"
        body={error}
        cta={{ href: profileHref, label: "Back to profile" }}
      />
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <EmptyState
        title="No matches found"
        body="Add more specifics to your profile and try again."
        cta={{ href: profileHref, label: "Edit profile" }}
      />
    );
  }

  const active = matches.find((m) => m.iscoCode === activeIsco) ?? matches[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      {/* LEFT — match list */}
      <aside className="space-y-3">
        <div className="rounded-xl border border-neutral-800/80 bg-linear-to-b from-neutral-900/60 to-neutral-950 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            Top matches · {countryName}
          </p>
          <p className="mt-1 text-sm text-neutral-300">
            {matches.length} occupations ranked by skills fit
          </p>
        </div>
        <ul className="space-y-2">
          {matches.map((m) => (
            <li key={m.iscoCode}>
              <button
                onClick={() => setActiveIsco(m.iscoCode)}
                className={clsx(
                  "group w-full rounded-xl border p-4 text-left transition",
                  m.iscoCode === active.iscoCode
                    ? "border-sky-500/60 bg-sky-500/5"
                    : "border-neutral-800/80 bg-neutral-900/30 hover:border-neutral-700 hover:bg-neutral-900/60"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-neutral-100">
                    {m.title}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                    {m.iscoCode}
                  </span>
                </div>
                <FitBar value={m.fitScore} />
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral-400">
                  <Pill tone="accent">
                    <Wallet className="h-3 w-3" />
                    {currencySymbol} {m.medianWageMonthly.toLocaleString()}/mo
                  </Pill>
                  <Pill tone={m.sectorGrowthYoY >= 0 ? "positive" : "danger"}>
                    <TrendingUp className="h-3 w-3" />
                    {m.sectorGrowthYoY >= 0 ? "+" : ""}
                    {m.sectorGrowthYoY.toFixed(1)}%
                  </Pill>
                  <RiskPill score={m.automationRiskCalibrated} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* RIGHT — detail */}
      <section className="space-y-6">
        <div className="rounded-2xl border border-neutral-800/80 bg-linear-to-br from-neutral-900/60 via-neutral-950 to-neutral-950 p-6 shadow-[0_0_60px_-30px_rgba(56,189,248,0.4)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-sky-400">
                ISCO {active.iscoCode} · Fit {(active.fitScore * 100).toFixed(0)}%
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-neutral-50">
                {active.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-neutral-400">
                {active.honestExplanation}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <SignalCard
              icon={<Wallet className="h-4 w-4" />}
              label="Median monthly wage"
              value={`${currencySymbol} ${active.medianWageMonthly.toLocaleString()}`}
              sub={`Source: ILOSTAT · ${currency}`}
            />
            <SignalCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Sector growth (YoY)"
              value={`${active.sectorGrowthYoY >= 0 ? "+" : ""}${active.sectorGrowthYoY.toFixed(1)}%`}
              sub="Source: World Bank WDI"
              tone={active.sectorGrowthYoY >= 0 ? "positive" : "danger"}
            />
            <SignalCard
              icon={<ShieldAlert className="h-4 w-4" />}
              label="AI displacement risk"
              value={`${(active.automationRiskCalibrated * 100).toFixed(0)}%`}
              sub={`Frey-Osborne raw ${(active.automationRiskRaw * 100).toFixed(0)}% · LMIC-calibrated`}
              tone={
                active.automationRiskCalibrated < 0.35
                  ? "positive"
                  : active.automationRiskCalibrated < 0.65
                    ? "warning"
                    : "danger"
              }
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-500">
                Skills you have that match
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {active.matchedSkills.map((s) => (
                  <Pill key={s} tone="accent">
                    {s}
                  </Pill>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-500">
                Adjacent skills that would strengthen fit
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {active.missingSkills.length === 0 ? (
                  <span className="text-xs text-neutral-500">
                    Profile already covers core skills.
                  </span>
                ) : (
                  active.missingSkills.map((s) => (
                    <Pill key={s} tone="neutral">
                      + {s}
                    </Pill>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pathways */}
        <div>
          <header className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-neutral-200">
                Reachable pathways
              </h3>
              <p className="text-xs text-neutral-500">
                Formal · Self-employment · Gig · Training — generated for {countryName}
              </p>
            </div>
          </header>
          <div className="grid gap-3 sm:grid-cols-2">
            {(pathways[active.iscoCode] ?? []).length === 0 ? (
              <PathwaySkeleton />
            ) : (
              pathways[active.iscoCode].map((o) => (
                <PathwayCard key={o.id} opportunity={o} />
              ))
            )}
          </div>
        </div>

        {/* Live jobs */}
        <div>
          <header className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-200">
              Live job listings
            </h3>
            <span className="text-xs text-neutral-500">via Tavily Search</span>
          </header>
          <div className="space-y-2">
            {(jobs[active.iscoCode] ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-800 p-4 text-xs text-neutral-500">
                No live listings surfaced (or Tavily key not configured).
              </p>
            ) : (
              jobs[active.iscoCode].map((j) => (
                <a
                  key={j.url}
                  href={j.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start justify-between gap-4 rounded-lg border border-neutral-800/80 bg-neutral-900/30 p-4 transition hover:border-sky-500/50 hover:bg-neutral-900/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-100">
                      {j.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                      {j.snippet}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-500 transition group-hover:text-sky-400" />
                </a>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function FitBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
      <div
        className="h-full rounded-full bg-linear-to-r from-sky-500 to-emerald-400"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function RiskPill({ score }: { score: number }) {
  const tone: "positive" | "warning" | "danger" =
    score < 0.35 ? "positive" : score < 0.65 ? "warning" : "danger";
  const label = score < 0.35 ? "Low AI risk" : score < 0.65 ? "Medium AI risk" : "High AI risk";
  return <Pill tone={tone}>{label}</Pill>;
}

function SignalCard({
  icon,
  label,
  value,
  sub,
  tone = "accent",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: "accent" | "positive" | "warning" | "danger";
}) {
  const accent: Record<string, string> = {
    accent: "text-sky-300",
    positive: "text-emerald-300",
    warning: "text-amber-300",
    danger: "text-rose-300",
  };
  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4">
      <div className="flex items-center gap-2 text-neutral-500">
        <span>{icon}</span>
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <p className={clsx("mt-2 text-xl font-semibold", accent[tone])}>{value}</p>
      <p className="mt-1 text-[11px] text-neutral-500">{sub}</p>
    </div>
  );
}

function PathwayCard({ opportunity }: { opportunity: Opportunity }) {
  const TONE: Record<OpportunityType, "accent" | "positive" | "warning" | "neutral"> = {
    formal: "accent",
    "self-employment": "positive",
    gig: "warning",
    training: "neutral",
  };
  return (
    <article className="rounded-xl border border-neutral-800/80 bg-linear-to-br from-neutral-900/40 to-neutral-950 p-4 transition hover:border-neutral-700">
      <div className="flex items-center justify-between gap-3">
        <Pill tone={TONE[opportunity.type]}>
          {TYPE_ICON[opportunity.type]} {TYPE_LABEL[opportunity.type]}
        </Pill>
        {opportunity.estimatedEarning && (
          <span className="text-[11px] text-neutral-400">
            {opportunity.estimatedEarning}
          </span>
        )}
      </div>
      <h4 className="mt-3 text-sm font-medium text-neutral-100">
        {opportunity.title}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-neutral-400">
        {opportunity.description}
      </p>
      <footer className="mt-3 flex items-center justify-between text-[11px] text-neutral-500">
        <span>{opportunity.source}</span>
        {opportunity.timeToReadiness && <span>{opportunity.timeToReadiness}</span>}
      </footer>
    </article>
  );
}

function PathwaySkeleton() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-xl border border-neutral-800/60 bg-neutral-900/30"
        />
      ))}
    </>
  );
}

function EmptyState({
  title,
  body,
  cta,
  loading,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
  loading?: boolean;
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/20 px-6 py-20 text-center">
      <div className="max-w-md space-y-3">
        {loading && (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-sky-400" />
        )}
        {!loading && <Info className="mx-auto h-6 w-6 text-neutral-500" />}
        <h3 className="text-lg font-medium text-neutral-200">{title}</h3>
        <p className="text-sm text-neutral-400">{body}</p>
        {cta && (
          <Link
            href={cta.href}
            className="inline-flex rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-sky-400"
          >
            {cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}
