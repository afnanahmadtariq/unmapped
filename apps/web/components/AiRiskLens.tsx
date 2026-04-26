"use client";

import { useMemo } from "react";
import clsx from "clsx";
import Pill from "@/components/Pill";

interface SectorRisk {
  sectorId: string;
  occupations: string[];
  rawAvg: number;
  calibrated: number;
}

interface Props {
  rows: SectorRisk[];
  multiplier: number;
  title: string;
  subtitle: string;
  riskLow: string;
  riskMed: string;
  riskHigh: string;
}

export default function AiRiskLens({
  rows,
  multiplier,
  title,
  subtitle,
  riskLow,
  riskMed,
  riskHigh,
}: Props) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.calibrated - a.calibrated),
    [rows]
  );

  return (
    <section className="rounded-2xl border border-border-default bg-bg-raised p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-fg-primary">{title}</h3>
          <p className="text-[11px] text-fg-muted">{subtitle}</p>
        </div>
        <Pill tone="accent">×{multiplier.toFixed(2)}</Pill>
      </header>

      <ul className="space-y-2">
        {sorted.map((r) => {
          const level: "low" | "med" | "high" =
            r.calibrated < 0.35 ? "low" : r.calibrated < 0.65 ? "med" : "high";
          const label = level === "low" ? riskLow : level === "med" ? riskMed : riskHigh;
          const barColor =
            level === "low"
              ? "bg-positive"
              : level === "med"
                ? "bg-warning"
                : "bg-danger";

          return (
            <li
              key={r.sectorId}
              className="grid items-center gap-3 rounded-lg border border-border-default bg-bg-base p-3 sm:grid-cols-[140px_1fr_auto]"
            >
              <span className="text-sm font-medium text-fg-primary">
                {r.sectorId}
              </span>
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-hover">
                  <div
                    className={clsx("h-full rounded-full transition", barColor)}
                    style={{ width: `${Math.round(r.calibrated * 100)}%` }}
                  />
                </div>
                <p className="line-clamp-1 text-[11px] text-fg-muted">
                  {r.occupations.slice(0, 3).join(", ")}
                  {r.occupations.length > 3 && ` +${r.occupations.length - 3}`}
                </p>
              </div>
              <div className="flex items-center gap-2 justify-self-end">
                <span className="font-mono text-[11px] text-fg-muted">
                  raw {Math.round(r.rawAvg * 100)}%
                </span>
                <span className="font-mono text-sm font-semibold text-fg-primary">
                  {Math.round(r.calibrated * 100)}%
                </span>
                <Pill
                  tone={level === "low" ? "positive" : level === "med" ? "warning" : "danger"}
                >
                  {label}
                </Pill>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
