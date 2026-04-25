"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { ChevronDown, Download, TrendingUp, Users, Briefcase } from "lucide-react";
import Pill from "@/components/Pill";

type Snapshot = {
  countryCode: string;
  countryName: string;
  currency: string;
  currencySymbol: string;
  youthUnemploymentRate: number;
  informalEmploymentShare: number;
  minimumWage: number;
  growthBySector: Record<string, number>;
  wagesByISCO: Record<string, number>;
  occupationLookup: Record<string, { title: string; sectorId: string }>;
  automationCalibration: { multiplier: number; rationale: string };
};

interface Props {
  snapshot: Snapshot;
}

export default function PolicyDashboard({ snapshot }: Props) {
  const sectorData = useMemo(
    () =>
      Object.entries(snapshot.growthBySector)
        .map(([sector, growth]) => ({ sector, growth }))
        .sort((a, b) => b.growth - a.growth),
    [snapshot.growthBySector]
  );

  const wageData = useMemo(() => {
    const rows = Object.entries(snapshot.wagesByISCO).map(([iscoCode, wage]) => {
      const lookup = snapshot.occupationLookup[iscoCode];
      return {
        iscoCode,
        wage,
        title: lookup?.title ?? iscoCode,
        sector: lookup?.sectorId ?? "OTHER",
      };
    });
    return rows.sort((a, b) => b.wage - a.wage).slice(0, 12);
  }, [snapshot.wagesByISCO, snapshot.occupationLookup]);

  const radarData = useMemo(() => {
    return sectorData.slice(0, 8).map((d) => ({
      sector: d.sector,
      growth: Math.max(0, d.growth + 5), // shift so radar isn't dominated by negatives
    }));
  }, [sectorData]);

  const exportCsv = () => {
    const rows = [
      ["sector", "yoy_growth_pct"],
      ...sectorData.map((s) => [s.sector, s.growth.toString()]),
      [],
      ["isco", "title", "sector", "median_monthly_wage_local"],
      ...wageData.map((w) => [w.iscoCode, w.title, w.sector, w.wage.toString()]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unmapped-${snapshot.countryCode.toLowerCase()}-snapshot.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Youth unemployment"
          value={`${snapshot.youthUnemploymentRate.toFixed(1)}%`}
          sub="ILOSTAT · 2023"
          tone="warning"
        />
        <Kpi
          icon={<Briefcase className="h-4 w-4" />}
          label="Informal employment share"
          value={`${snapshot.informalEmploymentShare.toFixed(1)}%`}
          sub="ILO Informality Stats"
          tone="accent"
        />
        <Kpi
          icon={<TrendingUp className="h-4 w-4" />}
          label="Minimum wage"
          value={`${snapshot.currencySymbol} ${snapshot.minimumWage.toLocaleString()}`}
          sub={`Per month · ${snapshot.currency}`}
          tone="positive"
        />
      </div>

      {/* Sector growth */}
      <Card title="Sector employment growth (YoY)" subtitle="Source: World Bank WDI + ILO">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={sectorData} margin={{ top: 10, right: 16, bottom: 30, left: 0 }}>
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="sector"
              tick={{ fill: "#737373", fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
              height={60}
            />
            <YAxis tick={{ fill: "#737373", fontSize: 11 }} unit="%" />
            <Tooltip
              cursor={{ fill: "rgba(56,189,248,0.06)" }}
              contentStyle={{ background: "#0a0a0a", border: "1px solid #262626", borderRadius: 8, color: "#f5f5f5" }}
              formatter={(value) => [`${Number(value).toFixed(1)}%`, "Growth"]}
            />
            <Bar dataKey="growth" radius={[4, 4, 0, 0]}>
              {sectorData.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.growth >= 0 ? "#38bdf8" : "#f43f5e"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Top occupations by median wage" subtitle="ILOSTAT · monthly nominal earnings">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart layout="vertical" data={wageData} margin={{ top: 10, right: 16, bottom: 10, left: 110 }}>
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#737373", fontSize: 11 }} />
              <YAxis dataKey="title" type="category" tick={{ fill: "#a3a3a3", fontSize: 11 }} width={100} />
              <Tooltip
                cursor={{ fill: "rgba(56,189,248,0.06)" }}
                contentStyle={{ background: "#0a0a0a", border: "1px solid #262626", borderRadius: 8, color: "#f5f5f5" }}
                formatter={(value) => [`${snapshot.currencySymbol} ${Number(value).toLocaleString()}`, "Median wage"]}
              />
              <Bar dataKey="wage" fill="#34d399" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Sector demand profile" subtitle="Normalised radar of YoY growth">
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#262626" />
              <PolarAngleAxis dataKey="sector" tick={{ fill: "#a3a3a3", fontSize: 10 }} />
              <PolarRadiusAxis tick={{ fill: "#525252", fontSize: 10 }} />
              <Radar dataKey="growth" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.25} />
              <Legend wrapperStyle={{ color: "#a3a3a3", fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card
        title="Automation calibration assumption"
        subtitle="The Frey-Osborne baseline is OECD-calibrated. We multiply per country."
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-neutral-300">
              Active multiplier:{" "}
              <span className="font-mono text-sky-300">
                ×{snapshot.automationCalibration.multiplier.toFixed(2)}
              </span>{" "}
              vs OECD baseline
            </p>
            <p className="mt-1 max-w-3xl text-xs text-neutral-500">
              {snapshot.automationCalibration.rationale}
            </p>
          </div>
          <Pill tone="accent">{snapshot.countryName}</Pill>
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-700 px-4 py-2 text-xs text-neutral-300 hover:bg-neutral-900"
        >
          <Download className="h-4 w-4" /> Export snapshot (CSV)
        </button>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "accent" | "positive" | "warning";
}) {
  const accent: Record<string, string> = {
    accent: "text-sky-300",
    positive: "text-emerald-300",
    warning: "text-amber-300",
  };
  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-linear-to-br from-neutral-900/60 to-neutral-950 p-5">
      <div className="flex items-center gap-2 text-neutral-500">
        <span>{icon}</span>
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <p className={`mt-2 text-3xl font-semibold ${accent[tone]}`}>{value}</p>
      <p className="mt-1 text-[11px] text-neutral-500">{sub}</p>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-5">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-neutral-200">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-neutral-500">{subtitle}</p>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-neutral-700" />
      </header>
      {children}
    </section>
  );
}
