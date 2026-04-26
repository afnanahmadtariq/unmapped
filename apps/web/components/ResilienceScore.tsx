"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { Shield, TrendingUp, Layers, Plug } from "lucide-react";
import type { ResilienceBreakdown } from "@/lib/apiClient";
import type { Dictionary } from "@/lib/i18n";

interface Props {
  score: ResilienceBreakdown;
  t: Dictionary;
}

const BAND_TONE: Record<ResilienceBreakdown["band"], string> = {
  low: "text-danger",
  medium: "text-warning",
  high: "text-positive",
  "very-high": "text-positive",
};

const BAND_KEY: Record<ResilienceBreakdown["band"], keyof Dictionary["opportunities"]> = {
  low: "resilienceBandLow",
  medium: "resilienceBandMedium",
  high: "resilienceBandHigh",
  "very-high": "resilienceBandVeryHigh",
};

export default function ResilienceScore({ score, t }: Props) {
  const pct = Math.max(0, Math.min(100, score.total));
  const bandLabel = t.opportunities[BAND_KEY[score.band]];

  return (
    <section className="rounded-2xl border border-border-default bg-bg-raised p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-fg-primary">{t.opportunities.resilienceTitle}</h3>
          <p className="text-[11px] text-fg-muted">{t.opportunities.resilienceSubtitle}</p>
        </div>
        <span className={clsx("text-xs font-medium uppercase tracking-wider", BAND_TONE[score.band])}>
          {bandLabel}
        </span>
      </header>

      <div className="mb-6">
        <div className="mb-2 flex items-end justify-between gap-2">
          <span className="text-3xl font-semibold tabular-nums text-fg-primary">{pct}</span>
          <span className="text-[10px] uppercase tracking-widest text-fg-muted">
            {t.opportunities.resilienceScoreOutOf}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-bg-hover">
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        <SubBar
          icon={<Layers className="h-3.5 w-3.5" />}
          label={t.opportunities.resilienceSkillDiversity}
          value={score.diversity}
          max={25}
          hint={t.opportunities.resilienceSkillDiversityHint}
        />
        <SubBar
          icon={<Shield className="h-3.5 w-3.5" />}
          label={t.opportunities.resilienceAiDurability}
          value={score.durability}
          max={25}
          hint={t.opportunities.resilienceAiDurabilityHint}
        />
        <SubBar
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label={t.opportunities.resilienceSectorMomentum}
          value={score.momentum}
          max={25}
          hint={t.opportunities.resilienceSectorMomentumHint}
        />
        <SubBar
          icon={<Plug className="h-3.5 w-3.5" />}
          label={t.opportunities.resilienceAdjacency}
          value={score.adjacency}
          max={25}
          hint={t.opportunities.resilienceAdjacencyHint}
        />
      </div>

      {score.notes.length > 0 && (
        <ul className="mt-5 space-y-1.5 border-t border-border-default pt-4 text-xs text-fg-secondary">
          {score.notes.map((n, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SubBar({
  icon,
  label,
  value,
  max,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  max: number;
  hint: string;
}) {
  const barPct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-fg-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-accent">{icon}</span>
          {label}
        </span>
        <span className="font-mono text-fg-muted">
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-hover">
        <div className="h-full rounded-full bg-accent transition" style={{ width: `${barPct}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-fg-muted">{hint}</p>
    </div>
  );
}
