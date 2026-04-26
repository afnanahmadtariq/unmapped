import SiteHeader from "@/components/SiteHeader";
import PolicyDashboard from "@/components/PolicyDashboard";
import Pill from "@/components/Pill";
import { Sparkles } from "lucide-react";
import { getCountry, DEFAULT_COUNTRY } from "@/lib/config";
import { getDictionary, fmt } from "@/lib/i18n";
import { getCountryData, ISCO_OCCUPATIONS } from "@/lib/data";
import { calibrateRisk } from "@/lib/calibration";
import { fetchIndicators } from "@/lib/worldBankApi";
import { getProjectionsForCountry } from "@/lib/wittgenstein";

interface PageProps {
  searchParams: Promise<{ country?: string; locale?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const country = getCountry(sp.country ?? DEFAULT_COUNTRY);
  const locale = sp.locale ?? country.defaultLocale;
  const t = getDictionary(locale);
  const data = getCountryData(country.code);

  // Live World Bank pull (with snapshot fallback baked into the client).
  const liveWb = await fetchIndicators(country.code, [
    "YOUTH_UNEMPLOYMENT",
    "GDP_PCAP",
    "INTERNET_USERS",
  ]);
  const youthUnemploymentLive = liveWb.YOUTH_UNEMPLOYMENT;

  const occupationLookup = Object.fromEntries(
    ISCO_OCCUPATIONS.map((o) => [o.code, { title: o.title, sectorId: o.sectorId }])
  );

  // Aggregate Frey-Osborne risk by sector, then apply per-country calibration.
  const bySector = new Map<string, { rawSum: number; calSum: number; n: number; titles: string[] }>();
  for (const occ of ISCO_OCCUPATIONS) {
    const r = calibrateRisk(occ.code, country.code);
    const cur = bySector.get(occ.sectorId) ?? { rawSum: 0, calSum: 0, n: 0, titles: [] };
    cur.rawSum += r.raw;
    cur.calSum += r.calibrated;
    cur.n += 1;
    cur.titles.push(occ.title);
    bySector.set(occ.sectorId, cur);
  }
  const sectorRisks = Array.from(bySector.entries()).map(([sectorId, v]) => ({
    sectorId,
    occupations: v.titles,
    rawAvg: v.rawSum / v.n,
    calibrated: v.calSum / v.n,
  }));

  const wittgensteinProjections = getProjectionsForCountry(country.code);

  const snapshot = {
    countryCode: country.code,
    countryName: country.name,
    currency: country.currency,
    currencySymbol: country.currencySymbol,
    context: country.context,
    youthUnemploymentRate: youthUnemploymentLive?.value ?? data.growth.youthUnemploymentRate,
    youthUnemploymentSource: youthUnemploymentLive?.source ?? "snapshot",
    youthUnemploymentYear: youthUnemploymentLive?.year ?? 2023,
    gdpPerCapita: liveWb.GDP_PCAP?.value ?? null,
    gdpPerCapitaSource: liveWb.GDP_PCAP?.source ?? "snapshot",
    internetUsersPct: liveWb.INTERNET_USERS?.value ?? null,
    informalEmploymentShare: data.growth.informalEmploymentShare,
    minimumWage: data.wages.minimumWage,
    growthBySector: data.growth.growthBySector,
    wagesByISCO: data.wages.wagesByISCO,
    occupationLookup,
    automationCalibration: {
      multiplier: data.calibration.globalMultiplier,
      rationale: data.calibration.rationale,
    },
    sectorRisks,
    wittgensteinProjections,
  };

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader
        countryCode={country.code}
        locale={locale}
        active="dashboard"
        t={t}
      />

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8">
          <Pill tone="accent">
            <Sparkles className="h-3 w-3" />
            {t.dashboard.moduleEyebrow}
          </Pill>
          <h1 className="mt-3 text-3xl font-semibold text-fg-primary">
            {fmt(t.dashboard.titleFor, { country: country.name })}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-fg-secondary">
            {fmt(t.dashboard.subtitle, { context: country.context.replace("-", " ") })}
          </p>
        </div>
        <PolicyDashboard snapshot={snapshot} t={t} />
      </section>
    </main>
  );
}
