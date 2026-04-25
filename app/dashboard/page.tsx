import Link from "next/link";
import ContextSelector from "@/components/ContextSelector";
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
      <header className="flex items-center justify-between gap-4 border-b border-neutral-800 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/?country=${country.code}&locale=${locale}`}
            className="text-lg font-semibold tracking-wide text-sky-400 hover:text-sky-300"
          >
            UNMAPPED
          </Link>
          <span className="hidden text-xs text-neutral-500 md:inline">
            Module 03 · Policymaker view
          </span>
        </div>
        <ContextSelector
          country={country.code}
          locale={locale}
          labels={{
            country: t.selectors.country,
            language: t.selectors.language,
          }}
        />
      </header>

      <section className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-sky-400">
            {t.dashboard.title}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-100">
            {country.name} labour market snapshot
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Aggregate signals from ILOSTAT, World Bank WDI, ILO Future of Work
            and Frey-Osborne, calibrated for {country.context.replace("-", " ")} context.
          </p>
        </div>
        <PolicyDashboard snapshot={snapshot} />
      </section>
    </main>
  );
}
