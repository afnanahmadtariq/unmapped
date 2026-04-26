import SiteHeader from "@/components/SiteHeader";
import OpportunityWorkbench from "@/components/OpportunityWorkbench";
import WittgensteinCard from "@/components/WittgensteinCard";
import Pill from "@/components/Pill";
import { Sparkles } from "lucide-react";
import { getCountry, DEFAULT_COUNTRY } from "@/lib/config";
import { getDictionary, fmt } from "@/lib/i18n";
import { apiClient, type WittgensteinPoint } from "@/lib/apiClient";

interface PageProps {
  searchParams: Promise<{ country?: string; locale?: string }>;
}

export default async function OpportunitiesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const country = getCountry(sp.country ?? DEFAULT_COUNTRY);
  const locale = sp.locale ?? country.defaultLocale;
  const t = getDictionary(locale);
  const profileHref = `/profile?country=${country.code}&locale=${locale}`;

  let wittgensteinProjections: WittgensteinPoint[] | null = null;
  try {
    const snap = await apiClient.dashboardSnapshot(country.code);
    wittgensteinProjections = snap.wittgensteinProjections;
  } catch {
    wittgensteinProjections = null;
  }

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader
        countryCode={country.code}
        locale={locale}
        active="opportunities"
        t={t}
      />

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8">
          <Pill tone="accent">
            <Sparkles className="h-3 w-3" />
            {t.opportunities.moduleEyebrow}
          </Pill>
          <h1 className="mt-3 text-3xl font-semibold text-fg-primary">
            {fmt(t.opportunities.titleFor, { country: country.name })}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-fg-secondary">
            {t.opportunities.subtitle}
          </p>
        </div>
        {wittgensteinProjections && wittgensteinProjections.length > 0 ? (
          <div className="mb-8">
            <WittgensteinCard
              projections={wittgensteinProjections}
              title={t.opportunities.wittgensteinYouthTitle}
              subtitle={t.opportunities.wittgensteinYouthSubtitle}
              sourceFoot={fmt(t.opportunities.wittgensteinFoot, { country: country.name })}
            />
          </div>
        ) : null}
        <OpportunityWorkbench
          countryCode={country.code}
          countryName={country.name}
          currency={country.currency}
          currencySymbol={country.currencySymbol}
          locale={locale}
          t={t}
          profileHref={profileHref}
        />
      </section>
    </main>
  );
}
