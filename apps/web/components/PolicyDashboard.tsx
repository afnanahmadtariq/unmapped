"use client";

import { useEffect, useMemo, useState } from "react";
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
import AiRiskLens from "@/components/AiRiskLens";
import WittgensteinCard from "@/components/WittgensteinCard";
import type { Dictionary } from "@/lib/i18n";
import { fmt } from "@/lib/i18n";
import { apiClient, type CompositeSignals } from "@/lib/apiClient";

interface SectorRisk {
  sectorId: string;
  occupations: string[];
  rawAvg: number;
  calibrated: number;
}

type Snapshot = {
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
  wittgensteinProjections: Array<{
    year: 2025 | 2030 | 2035;
    shares: { noEdu: number; primary: number; lowerSec: number; upperSec: number; tertiary: number };
  }> | null;
};

interface Props {
  snapshot: Snapshot;
  t: Dictionary;
}

function readVar(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export default function PolicyDashboard({ snapshot, t }: Props) {
  const [tokens, setTokens] = useState({
    fgMuted: "#737373",
    fgSecondary: "#404040",
    border: "#e5e5e5",
    bg: "#ffffff",
    accent: "#0369a1",
    positive: "#059669",
    danger: "#dc2626",
  });
  const [composite, setComposite] = useState<CompositeSignals | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .compositeSignals(snapshot.countryCode)
      .then((s) => {
        if (!cancelled) setComposite(s);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [snapshot.countryCode]);

  useEffect(() => {
    const refresh = () =>
      setTokens({
        fgMuted: readVar("--fg-muted", "#737373"),
        fgSecondary: readVar("--fg-secondary", "#404040"),
        border: readVar("--border-default", "#e5e5e5"),
        bg: readVar("--bg-raised", "#ffffff"),
        accent: readVar("--accent", "#0369a1"),
        positive: readVar("--positive", "#059669"),
        danger: readVar("--danger", "#dc2626"),
      });
    refresh();
    const obs = new MutationObserver(refresh);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

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
      growth: Math.max(0, d.growth + 5),
    }));
  }, [sectorData]);

  const exportCsv = () => {
    const rows = [
      ["sector", "yoy_growth_pct"],
      ...sectorData.map((s) => [s.sector, s.growth.toString()]),
      [],
      ["isco", "title", "sector", "median_monthly_wage_local"],
      ...wageData.map((w) => [w.iscoCode, w.title, w.sector, w.wage.toString()]),
      [],
      ["sector", "raw_avg_automation_pct", "calibrated_pct"],
      ...snapshot.sectorRisks.map((r) => [
        r.sectorId,
        Math.round(r.rawAvg * 100).toString(),
        Math.round(r.calibrated * 100).toString(),
      ]),
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

  const tooltipStyle = {
    background: tokens.bg,
    border: `1px solid ${tokens.border}`,
    borderRadius: 8,
    color: readVar("--fg-primary", "#0a0a0a"),
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label={t.dashboard.kpiYouth}
          value={`${snapshot.youthUnemploymentRate.toFixed(1)}%`}
          sub={
            snapshot.youthUnemploymentSource === "live-worldbank"
              ? `World Bank WDI · ${snapshot.youthUnemploymentYear}`
              : t.dashboard.kpiYouthSub
          }
          tone="warning"
          live={snapshot.youthUnemploymentSource === "live-worldbank"}
        />
        <Kpi
          icon={<Briefcase className="h-4 w-4" />}
          label={t.dashboard.kpiInformal}
          value={`${snapshot.informalEmploymentShare.toFixed(1)}%`}
          sub={t.dashboard.kpiInformalSub}
          tone="accent"
        />
        <Kpi
          icon={<TrendingUp className="h-4 w-4" />}
          label={t.dashboard.kpiMinWage}
          value={`${snapshot.currencySymbol} ${snapshot.minimumWage.toLocaleString()}`}
          sub={fmt(t.dashboard.kpiMinWageSub, { currency: snapshot.currency })}
          tone="positive"
        />
      </div>

      {(snapshot.gdpPerCapita || snapshot.internetUsersPct) && (
        <div className="grid gap-4 md:grid-cols-2">
          {snapshot.gdpPerCapita !== null && (
            <Kpi
              icon={<TrendingUp className="h-4 w-4" />}
              label={t.dashboard.kpiGdpLabel}
              value={`$${Math.round(snapshot.gdpPerCapita).toLocaleString()}`}
              sub={
                snapshot.gdpPerCapitaSource === "live-worldbank"
                  ? t.dashboard.kpiGdpSubLive
                  : t.dashboard.kpiGdpSubSnap
              }
              tone="accent"
              live={snapshot.gdpPerCapitaSource === "live-worldbank"}
            />
          )}
          {snapshot.internetUsersPct !== null && (
            <Kpi
              icon={<Users className="h-4 w-4" />}
              label={t.dashboard.kpiInternetLabel}
              value={`${snapshot.internetUsersPct.toFixed(1)}%`}
              sub={t.dashboard.kpiInternetSub}
              tone="positive"
              live
            />
          )}
        </div>
      )}

      <Card title={t.dashboard.sectorGrowthTitle} subtitle={t.dashboard.sectorGrowthSub}>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={sectorData} margin={{ top: 10, right: 16, bottom: 30, left: 0 }}>
            <CartesianGrid stroke={tokens.border} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="sector"
              tick={{ fill: tokens.fgMuted, fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
              height={60}
            />
            <YAxis tick={{ fill: tokens.fgMuted, fontSize: 11 }} unit="%" />
            <Tooltip
              cursor={{ fill: tokens.accent + "10" }}
              contentStyle={tooltipStyle}
              formatter={(value) => [`${Number(value).toFixed(1)}%`, t.dashboard.chartTooltipGrowth]}
            />
            <Bar dataKey="growth" radius={[4, 4, 0, 0]}>
              {sectorData.map((d, i) => (
                <Cell key={i} fill={d.growth >= 0 ? tokens.accent : tokens.danger} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <AiRiskLens
        rows={snapshot.sectorRisks}
        multiplier={snapshot.automationCalibration.multiplier}
        title={t.dashboard.aiLensTitle}
        subtitle={t.dashboard.aiLensSub}
        riskLow={t.dashboard.aiLensRiskLow}
        riskMed={t.dashboard.aiLensRiskMed}
        riskHigh={t.dashboard.aiLensRiskHigh}
      />

      {snapshot.wittgensteinProjections && (
        <WittgensteinCard
          projections={snapshot.wittgensteinProjections}
          title={t.dashboard.wittgensteinTitle}
          subtitle={t.dashboard.wittgensteinSubtitle}
          sourceFoot={fmt(t.dashboard.wittgensteinFoot, { country: snapshot.countryName })}
        />
      )}

      <CompositeSignalsSection composite={composite} t={t} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t.dashboard.topWagesTitle} subtitle={t.dashboard.topWagesSub}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart layout="vertical" data={wageData} margin={{ top: 10, right: 16, bottom: 10, left: 110 }}>
              <CartesianGrid stroke={tokens.border} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: tokens.fgMuted, fontSize: 11 }} />
              <YAxis dataKey="title" type="category" tick={{ fill: tokens.fgSecondary, fontSize: 11 }} width={100} />
              <Tooltip
                cursor={{ fill: tokens.accent + "10" }}
                contentStyle={tooltipStyle}
                formatter={(value) => [
                  `${snapshot.currencySymbol} ${Number(value).toLocaleString()}`,
                  t.dashboard.chartTooltipMedianWage,
                ]}
              />
              <Bar dataKey="wage" fill={tokens.positive} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title={t.dashboard.radarTitle} subtitle={t.dashboard.radarSub}>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={tokens.border} />
              <PolarAngleAxis dataKey="sector" tick={{ fill: tokens.fgSecondary, fontSize: 10 }} />
              <PolarRadiusAxis tick={{ fill: tokens.fgMuted, fontSize: 10 }} />
              <Radar dataKey="growth" stroke={tokens.accent} fill={tokens.accent} fillOpacity={0.25} />
              <Legend wrapperStyle={{ color: tokens.fgSecondary, fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title={t.dashboard.calibrationTitle} subtitle={t.dashboard.calibrationSub}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-fg-secondary">
              {t.dashboard.calibrationActive}{" "}
              <span className="font-mono text-accent">
                ×{snapshot.automationCalibration.multiplier.toFixed(2)}
              </span>{" "}
              {t.dashboard.calibrationVs}
            </p>
            <p className="mt-1 max-w-3xl text-xs text-fg-muted">
              {snapshot.automationCalibration.rationale}
            </p>
          </div>
          <Pill tone="accent">{snapshot.countryName}</Pill>
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-md border border-border-default bg-bg-raised px-4 py-2 text-xs text-fg-secondary hover:bg-bg-hover"
        >
          <Download className="h-4 w-4" /> {t.dashboard.exportCsv}
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
  live,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "accent" | "positive" | "warning";
  live?: boolean;
}) {
  const accent: Record<string, string> = {
    accent: "text-accent",
    positive: "text-positive",
    warning: "text-warning",
  };
  return (
    <div className="rounded-2xl border border-border-default bg-bg-raised p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-fg-muted">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-[10px] uppercase tracking-widest">{label}</span>
        </div>
        {live && (
          <span className="inline-flex items-center gap-1 rounded-full border border-positive/30 bg-positive/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-positive">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-positive" />
            Live
          </span>
        )}
      </div>
      <p className={`mt-2 text-3xl font-semibold ${accent[tone]}`}>{value}</p>
      <p className="mt-1 text-[11px] text-fg-muted">{sub}</p>
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
    <section className="rounded-2xl border border-border-default bg-bg-raised p-5 shadow-sm">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-fg-primary">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-fg-muted">{subtitle}</p>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-border-strong" />
      </header>
      {children}
    </section>
  );
}

function fmtPct(v: number | null, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

function fmtFraction(v: number | null, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

function CompositeSignalsSection({
  composite,
  t,
}: {
  composite: CompositeSignals | null;
  t: Dictionary;
}) {
  if (!composite) return null;
  const d = t.dashboard;
  const groups: Array<{
    key: string;
    title: string;
    subtitle: string;
    rows: Array<{ key: string; label: string; value: string; tone?: "positive" | "warning" | "danger" }>;
  }> = [
    {
      key: "demand",
      title: d.compGroupDemandTitle,
      subtitle: d.compGroupDemandSub,
      rows: [
        {
          key: "vac",
          label: d.compVacancies,
          value:
            composite.demand.vacancyRate !== null
              ? `${composite.demand.vacancyRate}`
              : "—",
        },
        {
          key: "growth",
          label: d.compSectorEmpGrowth,
          value: fmtPct(composite.demand.sectorEmploymentGrowth, 1),
          tone:
            composite.demand.sectorEmploymentGrowth !== null &&
            composite.demand.sectorEmploymentGrowth >= 0
              ? "positive"
              : "danger",
        },
        {
          key: "gap",
          label: d.compDemandSupplyGap,
          value:
            composite.demand.demandSupplyGap !== null
              ? composite.demand.demandSupplyGap.toFixed(1)
              : "—",
        },
      ],
    },
    {
      key: "skills",
      title: d.compGroupSkillsTitle,
      subtitle: d.compGroupSkillsSub,
      rows: [
        {
          key: "dur",
          label: d.compSkillDurability,
          value: fmtFraction(composite.automation.skillDurability),
          tone:
            composite.automation.skillDurability !== null &&
            composite.automation.skillDurability >= 0.6
              ? "positive"
              : "warning",
        },
        {
          key: "xfer",
          label: d.compCrossTransfer,
          value: fmtFraction(composite.skillsDemand.crossSkillTransferability),
        },
        {
          key: "routine",
          label: d.compRoutineShare,
          value: fmtFraction(composite.automation.routineRatio),
          tone:
            composite.automation.routineRatio !== null &&
            composite.automation.routineRatio >= 0.6
              ? "danger"
              : "warning",
        },
      ],
    },
    {
      key: "regional",
      title: d.compGroupRegionalTitle,
      subtitle: d.compGroupRegionalSub,
      rows: [
        {
          key: "inet",
          label: d.compInternetRate,
          value: fmtPct(composite.regional.internetRate),
        },
        {
          key: "bb",
          label: d.compBroadband,
          value: fmtPct(composite.regional.broadbandRate),
        },
        {
          key: "gapu",
          label: d.compUrbanRuralGap,
          value: fmtPct(composite.regional.urbanRuralGap),
          tone:
            composite.regional.urbanRuralGap !== null &&
            composite.regional.urbanRuralGap > 20
              ? "danger"
              : "warning",
        },
      ],
    },
    {
      key: "ineq",
      title: d.compGroupInequalityTitle,
      subtitle: d.compGroupInequalitySub,
      rows: [
        {
          key: "gender",
          label: d.compGenderGap,
          value: fmtPct(composite.inequality.genderEmploymentGap),
          tone:
            composite.inequality.genderEmploymentGap !== null &&
            composite.inequality.genderEmploymentGap < -10
              ? "danger"
              : "warning",
        },
        {
          key: "informal",
          label: d.compInformalShare,
          value: fmtFraction(composite.inequality.informalShare),
          tone:
            composite.inequality.informalShare !== null &&
            composite.inequality.informalShare > 0.5
              ? "danger"
              : "warning",
        },
      ],
    },
    {
      key: "stab",
      title: d.compGroupStabilityTitle,
      subtitle: d.compGroupStabilitySub,
      rows: [
        {
          key: "vol",
          label: d.compSectorVol,
          value:
            composite.stability.sectorVolatilityIndex !== null
              ? composite.stability.sectorVolatilityIndex.toFixed(2)
              : "—",
        },
        {
          key: "season",
          label: d.compSeasonality,
          value: composite.stability.seasonalityFlag
            ? d.compSeasonalityYes
            : d.compSeasonalityNo,
        },
      ],
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {groups.map((g) => (
        <Card key={g.key} title={g.title} subtitle={g.subtitle}>
          <ul className="space-y-2 text-sm">
            {g.rows.map((row) => (
              <li
                key={`${g.key}-${row.key}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border-default bg-bg-base px-3 py-2"
              >
                <span className="text-fg-secondary">{row.label}</span>
                <span
                  className={
                    row.tone === "positive"
                      ? "font-mono text-positive"
                      : row.tone === "danger"
                        ? "font-mono text-danger"
                        : row.tone === "warning"
                          ? "font-mono text-warning"
                          : "font-mono text-fg-primary"
                  }
                >
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </section>
  );
}
