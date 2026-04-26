"use client";

import { useEffect, useState } from "react";
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
import ResilienceScore from "@/components/ResilienceScore";
import { readProfileFromHash } from "@/lib/profileUrl";
import { apiClient, type ResilienceBreakdown } from "@/lib/apiClient";
import type {
  CountryCode,
  MatchedOccupation,
  Opportunity,
  OpportunityType,
  SkillsProfile,
} from "@/types";
import type { Dictionary } from "@/lib/i18n";
import { fmt } from "@/lib/i18n";

interface Props {
  countryCode: CountryCode;
  countryName: string;
  currency: string;
  currencySymbol: string;
  locale: string;
  t: Dictionary;
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

export default function OpportunityWorkbench({
  countryCode,
  countryName,
  currency,
  currencySymbol,
  t,
  profileHref,
}: Props) {
  const [profile, setProfile] = useState<SkillsProfile | null>(null);
  const [matches, setMatches] = useState<MatchedOccupation[] | null>(null);
  const [resilience, setResilience] = useState<ResilienceBreakdown | null>(null);
  const [activeIsco, setActiveIsco] = useState<string | null>(null);
  const [pathways, setPathways] = useState<Record<string, Opportunity[]>>({});
  const [jobs, setJobs] = useState<Record<string, JobHit[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const TYPE_LABEL: Record<OpportunityType, string> = {
    formal: t.opportunities.typeFormal,
    "self-employment": t.opportunities.typeSelf,
    gig: t.opportunities.typeGig,
    training: t.opportunities.typeTraining,
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Priority order:
    //   1. profile encoded in URL hash (Save-link landing)
    //   2. sessionStorage (came from /profile this visit)
    const fromHash = readProfileFromHash();
    if (fromHash) {
      setProfile(fromHash);
      sessionStorage.setItem(
        `unmapped:profile:${fromHash.countryCode}`,
        JSON.stringify(fromHash)
      );
      return;
    }
    const raw = sessionStorage.getItem(`unmapped:profile:${countryCode}`);
    if (raw) {
      try {
        setProfile(JSON.parse(raw));
      } catch {
        // ignore
      }
    }
  }, [countryCode]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.matchOccupations({ profile, countryCode });
        if (cancelled) return;
        setMatches(data.matches);
        setResilience(data.resilience);
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

  useEffect(() => {
    if (!activeIsco || !matches) return;
    const occupation = matches.find((m) => m.iscoCode === activeIsco);
    if (!occupation) return;

    if (!pathways[activeIsco]) {
      apiClient
        .opportunityPathways({
          occupationTitle: occupation.title,
          iscoCode: activeIsco,
          countryCode,
          matchedSkills: occupation.matchedSkills,
        })
        .then((d) =>
          setPathways((prev) => ({ ...prev, [activeIsco]: d.opportunities ?? [] })),
        )
        .catch(() => undefined);
    }
    if (!jobs[activeIsco]) {
      apiClient
        .findJobs({ title: occupation.title, countryCode })
        .then((d) => setJobs((prev) => ({ ...prev, [activeIsco]: d.jobs ?? [] })))
        .catch(() => undefined);
    }
  }, [activeIsco, matches, pathways, jobs, countryCode]);

  if (!profile) {
    return (
      <EmptyState
        title={t.opportunities.noProfileTitle}
        body={t.opportunities.noProfileBody}
        cta={{ href: profileHref, label: t.opportunities.noProfileCta }}
      />
    );
  }

  if (loading) {
    return (
      <EmptyState
        title={t.opportunities.matchingTitle}
        body={t.opportunities.matchingBody}
        loading
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        title={t.opportunities.errorTitle}
        body={error}
        cta={{ href: profileHref, label: t.opportunities.errorCta }}
      />
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <EmptyState
        title={t.opportunities.noMatchesTitle}
        body={t.opportunities.noMatchesBody}
        cta={{ href: profileHref, label: t.opportunities.noMatchesCta }}
      />
    );
  }

  const active = matches.find((m) => m.iscoCode === activeIsco) ?? matches[0];

  return (
    <div className="space-y-6 animate-[fadeIn_240ms_ease-out]">
      {resilience && (
        <ResilienceScore
          score={resilience}
          title="Your resilience score"
          subtitle="Composite of skill diversity, AI durability, sector momentum, and adjacency to top matches"
        />
      )}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="rounded-xl border border-border-default bg-bg-raised p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-fg-muted">
            {fmt(t.opportunities.topMatches, { country: countryName })}
          </p>
          <p className="mt-1 text-sm text-fg-secondary">
            {fmt(t.opportunities.matchesRanked, { n: matches.length })}
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
                    ? "border-accent bg-accent/5"
                    : "border-border-default bg-bg-raised hover:border-border-strong hover:bg-bg-hover"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-fg-primary">{m.title}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                    {m.iscoCode}
                  </span>
                </div>
                <FitBar value={m.fitScore} />
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-fg-secondary">
                  <Pill tone="accent">
                    <Wallet className="h-3 w-3" />
                    {fmt(t.opportunities.wagePill, {
                      symbol: currencySymbol,
                      amount: m.medianWageMonthly.toLocaleString(),
                    })}
                  </Pill>
                  <Pill tone={m.sectorGrowthYoY >= 0 ? "positive" : "danger"}>
                    <TrendingUp className="h-3 w-3" />
                    {m.sectorGrowthYoY >= 0 ? "+" : ""}
                    {m.sectorGrowthYoY.toFixed(1)}%
                  </Pill>
                  <RiskPill score={m.automationRiskCalibrated} t={t} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="space-y-6">
        <div className="rounded-2xl border border-border-default bg-bg-raised p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
                ISCO {active.iscoCode} · Fit {(active.fitScore * 100).toFixed(0)}%
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-fg-primary">
                {active.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-fg-secondary">
                {active.honestExplanation}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <SignalCard
              icon={<Wallet className="h-4 w-4" />}
              label={t.opportunities.wageLabel}
              value={`${currencySymbol} ${active.medianWageMonthly.toLocaleString()}`}
              sub={fmt(t.opportunities.wageSub, { currency })}
            />
            <SignalCard
              icon={<TrendingUp className="h-4 w-4" />}
              label={t.opportunities.growthLabel}
              value={`${active.sectorGrowthYoY >= 0 ? "+" : ""}${active.sectorGrowthYoY.toFixed(1)}%`}
              sub={t.opportunities.growthSub}
              tone={active.sectorGrowthYoY >= 0 ? "positive" : "danger"}
            />
            <SignalCard
              icon={<ShieldAlert className="h-4 w-4" />}
              label={t.opportunities.riskLabel}
              value={`${(active.automationRiskCalibrated * 100).toFixed(0)}%`}
              sub={fmt(t.opportunities.riskSubLmic, {
                raw: (active.automationRiskRaw * 100).toFixed(0),
              })}
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
              <p className="text-[10px] uppercase tracking-widest text-fg-muted">
                {t.opportunities.skillsHave}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {active.matchedSkills.map((s) => (
                  <Pill key={s} tone="accent">{s}</Pill>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-fg-muted">
                {t.opportunities.skillsAdjacent}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {active.missingSkills.length === 0 ? (
                  <span className="text-xs text-fg-muted">
                    {t.opportunities.alreadyCovers}
                  </span>
                ) : (
                  active.missingSkills.map((s) => (
                    <Pill key={s} tone="neutral">+ {s}</Pill>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <header className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-fg-primary">
                {t.opportunities.pathwaysTitle}
              </h3>
              <p className="text-xs text-fg-muted">
                {fmt(t.opportunities.pathwaysHint, { country: countryName })}
              </p>
            </div>
          </header>
          <div className="grid gap-3 sm:grid-cols-2">
            {(pathways[active.iscoCode] ?? []).length === 0 ? (
              <PathwaySkeleton />
            ) : (
              pathways[active.iscoCode].map((o) => (
                <PathwayCard
                  key={o.id}
                  opportunity={o}
                  typeLabel={TYPE_LABEL[o.type]}
                />
              ))
            )}
          </div>
        </div>

        <div>
          <header className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-fg-primary">
              {t.opportunities.liveJobs}
            </h3>
            <span className="text-xs text-fg-muted">
              {t.opportunities.liveJobsSource}
            </span>
          </header>
          <div className="space-y-2">
            {(jobs[active.iscoCode] ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-border-default p-4 text-xs text-fg-muted">
                {t.opportunities.noLiveJobs}
              </p>
            ) : (
              jobs[active.iscoCode].map((j) => (
                <a
                  key={j.url}
                  href={j.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start justify-between gap-4 rounded-lg border border-border-default bg-bg-raised p-4 transition hover:border-accent/50 hover:bg-bg-hover"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg-primary">
                      {j.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-fg-muted">
                      {j.snippet}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-fg-muted transition group-hover:text-accent" />
                </a>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
    </div>
  );
}

function FitBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-bg-hover">
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

function RiskPill({ score, t }: { score: number; t: Dictionary }) {
  const tone: "positive" | "warning" | "danger" =
    score < 0.35 ? "positive" : score < 0.65 ? "warning" : "danger";
  const label =
    score < 0.35
      ? t.opportunities.lowAi
      : score < 0.65
        ? t.opportunities.mediumAi
        : t.opportunities.highAi;
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
    accent: "text-accent",
    positive: "text-positive",
    warning: "text-warning",
    danger: "text-danger",
  };
  return (
    <div className="rounded-xl border border-border-default bg-bg-base p-4">
      <div className="flex items-center gap-2 text-fg-muted">
        <span>{icon}</span>
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <p className={clsx("mt-2 text-xl font-semibold", accent[tone])}>{value}</p>
      <p className="mt-1 text-[11px] text-fg-muted">{sub}</p>
    </div>
  );
}

function PathwayCard({
  opportunity,
  typeLabel,
}: {
  opportunity: Opportunity;
  typeLabel: string;
}) {
  const TONE: Record<OpportunityType, "accent" | "positive" | "warning" | "neutral"> = {
    formal: "accent",
    "self-employment": "positive",
    gig: "warning",
    training: "neutral",
  };
  return (
    <article className="rounded-xl border border-border-default bg-bg-raised p-4 transition hover:border-border-strong hover:shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <Pill tone={TONE[opportunity.type]}>
          {TYPE_ICON[opportunity.type]} {typeLabel}
        </Pill>
        {opportunity.estimatedEarning && (
          <span className="text-[11px] text-fg-secondary">
            {opportunity.estimatedEarning}
          </span>
        )}
      </div>
      <h4 className="mt-3 text-sm font-medium text-fg-primary">
        {opportunity.title}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-fg-secondary">
        {opportunity.description}
      </p>
      <footer className="mt-3 flex items-center justify-between text-[11px] text-fg-muted">
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
        <div key={i} className="skeleton h-32 rounded-xl border border-border-default" />
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
    <div className="grid place-items-center rounded-2xl border border-dashed border-border-default bg-bg-raised px-6 py-20 text-center">
      <div className="max-w-md space-y-3">
        {loading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />
        ) : (
          <Info className="mx-auto h-6 w-6 text-fg-muted" />
        )}
        <h3 className="text-lg font-medium text-fg-primary">{title}</h3>
        <p className="text-sm text-fg-secondary">{body}</p>
        {cta && (
          <Link
            href={cta.href}
            className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
          >
            {cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}
