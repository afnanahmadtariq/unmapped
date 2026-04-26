"use client";

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
  const ring = `conic-gradient(var(--accent) 0 ${pct * 3.6}deg, color-mix(in oklab, var(--bg-hover) 70%, transparent) ${pct * 3.6}deg 360deg)`;
  const bandLabel = t.opportunities[BAND_KEY[score.band]];

  return (
    <section className="rounded-2xl border border-border-default bg-bg-raised p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-fg-primary">{t.opportunities.resilienceTitle}</h3>
          <p className="text-[11px] text-fg-muted">{t.opportunities.resilienceSubtitle}</p>
        </div>
        <span className={clsx("text-xs font-medium uppercase tracking-wider", BAND_TONE[score.band])}>
          {bandLabel}
        </span>
      </header>

      <div className="grid items-center gap-6 md:grid-cols-[160px_1fr]">
        <div className="grid place-items-center">
          <div
            className="grid h-32 w-32 place-items-center rounded-full"
            style={{ backgroundImage: ring }}
          >
            <div className="grid h-26 w-26 place-items-center rounded-full bg-bg-raised">
              <div className="text-center leading-none">
                <p className="text-3xl font-semibold text-fg-primary">{pct}</p>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-fg-muted">/ 100</p>
              </div>
            </div>
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
  icon: React.ReactNode;
  label: string;
  value: number;
  max: number;
  hint: string;
}) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-fg-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-accent">{icon}</span>
          {label}
        </span>
        <span className="font-mono text-fg-muted">{value}/{max}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-hover">
        <div className="h-full rounded-full bg-accent transition" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-fg-muted">{hint}</p>
    </div>
  );
}
