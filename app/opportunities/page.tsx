import SiteHeader from "@/components/SiteHeader";
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

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader
        countryCode={country.code}
        locale={locale}
        active="opportunities"
        labels={{ country: t.selectors.country, language: t.selectors.language }}
      />

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
            {t.opportunities.title}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-fg-primary">
            Realistic, reachable opportunities for {country.name}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-fg-secondary">
            Honest matches grounded in ILOSTAT wages, World Bank WDI sector
            growth, and Frey-Osborne automation scores, calibrated for LMIC
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
