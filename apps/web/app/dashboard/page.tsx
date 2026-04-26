import SiteHeader from "@/components/SiteHeader";
import PolicyDashboard from "@/components/PolicyDashboard";
import Pill from "@/components/Pill";
import { Sparkles } from "lucide-react";
import { getCountry, DEFAULT_COUNTRY } from "@/lib/config";
import { getDictionary, fmt } from "@/lib/i18n";
import { apiClient, type DashboardSnapshot } from "@/lib/apiClient";

interface PageProps {
  searchParams: Promise<{ country?: string; locale?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const country = getCountry(sp.country ?? DEFAULT_COUNTRY);
  const locale = sp.locale ?? country.defaultLocale;
  const t = getDictionary(locale);

  const snapshot: DashboardSnapshot = await apiClient.dashboardSnapshot(
    country.code,
  );

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
            {fmt(t.dashboard.titleFor, { country: snapshot.countryName })}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-fg-secondary">
            {fmt(t.dashboard.subtitle, {
              context: snapshot.context.replace("-", " "),
            })}
          </p>
        </div>
        <PolicyDashboard snapshot={snapshot} t={t} />
      </section>
    </main>
  );
}
