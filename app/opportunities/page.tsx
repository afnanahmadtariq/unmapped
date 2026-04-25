import Link from "next/link";
import ContextSelector from "@/components/ContextSelector";
import OpportunityWorkbench from "@/components/OpportunityWorkbench";
import { getCountry, DEFAULT_COUNTRY } from "@/lib/config";
import { getDictionary } from "@/lib/i18n";

interface PageProps {
  searchParams: Promise<{ country?: string; locale?: string }>;
}

export default async function OpportunitiesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const country = getCountry(sp.country ?? DEFAULT_COUNTRY);
  const locale = sp.locale ?? country.defaultLocale;
  const t = getDictionary(locale);
  const profileHref = `/profile?country=${country.code}&locale=${locale}`;
  const dashboardHref = `/dashboard?country=${country.code}&locale=${locale}`;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-800 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link
            href={`/?country=${country.code}&locale=${locale}`}
            className="text-lg font-semibold tracking-wide text-sky-400 hover:text-sky-300"
          >
            UNMAPPED
          </Link>
          <span className="hidden text-xs text-neutral-500 md:inline">
            Module 03 · Opportunity Matching
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={dashboardHref}
            className="hidden rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900 md:inline-block"
          >
            Open dashboard →
          </Link>
          <ContextSelector
            country={country.code}
            locale={locale}
            labels={{
              country: t.selectors.country,
              language: t.selectors.language,
            }}
          />
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-sky-400">
            {t.opportunities.title}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-100">
            Realistic, reachable opportunities for {country.name}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Honest matches grounded in ILOSTAT wages, World Bank WDI sector
            growth, and Frey-Osborne automation scores — calibrated for LMIC
            context. No aspirational fluff.
          </p>
        </div>
        <OpportunityWorkbench
          countryCode={country.code}
          countryName={country.name}
          currency={country.currency}
          currencySymbol={country.currencySymbol}
          locale={locale}
          profileHref={profileHref}
        />
      </section>
    </main>
  );
}
