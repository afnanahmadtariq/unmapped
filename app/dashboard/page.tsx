import SiteHeader from "@/components/SiteHeader";
import PolicyDashboard from "@/components/PolicyDashboard";
import { getCountry, DEFAULT_COUNTRY } from "@/lib/config";
import { getDictionary } from "@/lib/i18n";
import { getCountryData, ISCO_OCCUPATIONS } from "@/lib/data";

interface PageProps {
  searchParams: Promise<{ country?: string; locale?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const country = getCountry(sp.country ?? DEFAULT_COUNTRY);
  const locale = sp.locale ?? country.defaultLocale;
  const t = getDictionary(locale);
  const data = getCountryData(country.code);

  const occupationLookup = Object.fromEntries(
    ISCO_OCCUPATIONS.map((o) => [o.code, { title: o.title, sectorId: o.sectorId }])
  );

  const snapshot = {
    countryCode: country.code,
    countryName: country.name,
    currency: country.currency,
    currencySymbol: country.currencySymbol,
    youthUnemploymentRate: data.growth.youthUnemploymentRate,
    informalEmploymentShare: data.growth.informalEmploymentShare,
    minimumWage: data.wages.minimumWage,
    growthBySector: data.growth.growthBySector,
    wagesByISCO: data.wages.wagesByISCO,
    occupationLookup,
    automationCalibration: {
      multiplier: data.calibration.globalMultiplier,
      rationale: data.calibration.rationale,
    },
  };

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader
        countryCode={country.code}
        locale={locale}
        active="dashboard"
        labels={{ country: t.selectors.country, language: t.selectors.language }}
      />

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
            {t.dashboard.title}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-fg-primary">
            {country.name} labour market snapshot
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-fg-secondary">
            Aggregate signals from ILOSTAT, World Bank WDI, ILO Future of Work,
            and Frey-Osborne, calibrated for {country.context.replace("-", " ")} context.
          </p>
        </div>
        <PolicyDashboard snapshot={snapshot} />
      </section>
    </main>
  );
}
