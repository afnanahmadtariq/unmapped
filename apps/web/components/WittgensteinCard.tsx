"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo, useEffect, useState } from "react";
import Pill from "@/components/Pill";

interface ProjPoint {
  year: 2025 | 2030 | 2035;
  shares: { noEdu: number; primary: number; lowerSec: number; upperSec: number; tertiary: number };
}

interface Props {
  projections: ProjPoint[];
  title: string;
  subtitle: string;
  /** Localized attribution line (include country name via caller `fmt`). */
  sourceFoot: string;
}

function readVar(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const COLORS = ["#a3a3a3", "#fbbf24", "#0ea5e9", "#34d399", "#7c3aed"] as const;

export default function WittgensteinCard({ projections, title, subtitle, sourceFoot }: Props) {
  const [tokens, setTokens] = useState({ fgMuted: "#737373", border: "#e5e5e5", bg: "#ffffff" });
  useEffect(() => {
    const refresh = () =>
      setTokens({
        fgMuted: readVar("--fg-muted", "#737373"),
        border: readVar("--border-default", "#e5e5e5"),
        bg: readVar("--bg-raised", "#ffffff"),
      });
    refresh();
    const obs = new MutationObserver(refresh);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const data = useMemo(
    () =>
      projections.map((p) => ({
        year: String(p.year),
        "No formal": p.shares.noEdu,
        "Primary": p.shares.primary,
        "Lower sec": p.shares.lowerSec,
        "Upper sec": p.shares.upperSec,
        "Tertiary+": p.shares.tertiary,
      })),
    [projections]
  );

  const upperPlusTertiary2025 =
    (projections[0]?.shares.upperSec ?? 0) + (projections[0]?.shares.tertiary ?? 0);
  const upperPlusTertiary2035 =
    (projections.at(-1)?.shares.upperSec ?? 0) + (projections.at(-1)?.shares.tertiary ?? 0);
  const delta = upperPlusTertiary2035 - upperPlusTertiary2025;

  return (
    <section className="rounded-2xl border border-border-default bg-bg-raised p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-fg-primary">{title}</h3>
          <p className="text-[11px] text-fg-muted">{subtitle}</p>
        </div>
        <Pill tone={delta >= 0 ? "positive" : "warning"}>
          Upper-sec + tertiary 2025 -&gt; 2035: {upperPlusTertiary2025}% -&gt; {upperPlusTertiary2035}%
        </Pill>
      </header>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
          <CartesianGrid stroke={tokens.border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" tick={{ fill: tokens.fgMuted, fontSize: 11 }} />
          <YAxis tick={{ fill: tokens.fgMuted, fontSize: 11 }} unit="%" />
          <Tooltip
            contentStyle={{ background: tokens.bg, border: `1px solid ${tokens.border}`, borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: tokens.fgMuted }} />
          {(["No formal", "Primary", "Lower sec", "Upper sec", "Tertiary+"] as const).map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={COLORS[i]} />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <p className="mt-3 text-[11px] text-fg-muted">{sourceFoot}</p>
    </section>
  );
}
