import SiteHeader from "@/components/SiteHeader";
import PolicyDashboard from "@/components/PolicyDashboard";
import Pill from "@/components/Pill";
import { Sparkles, RefreshCw } from "lucide-react";
import { getCountry, DEFAULT_COUNTRY } from "@/lib/config";
import { getDictionary, fmt } from "@/lib/i18n";
import { apiClient, type DashboardSnapshot } from "@/lib/apiClient";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ country?: string; locale?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const country = getCountry(sp.country ?? DEFAULT_COUNTRY);
  const locale = sp.locale ?? country.defaultLocale;
  const t = getDictionary(locale);

  let snapshot: DashboardSnapshot | null = null;
  let fetchError: string | null = null;

  try {
    snapshot = await apiClient.dashboardSnapshot(country.code);
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Could not reach the data service.";
  }

  if (fetchError || !snapshot) {
    return (
      <main className="flex flex-1 flex-col">
        <SiteHeader
          countryCode={country.code}
          locale={locale}
          active="dashboard"
          t={t}
        />
        <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
          <div className="mb-4 rounded-full bg-warning/10 p-4">
            <RefreshCw className="h-8 w-8 text-warning" />
          </div>
          <h1 className="mb-2 text-xl font-semibold text-fg-primary">
            Dashboard data unavailable
          </h1>
          <p className="mb-1 max-w-sm text-sm text-fg-secondary">
            The data service is still starting up or temporarily unreachable.
            This usually resolves in a few seconds.
          </p>
          {fetchError && (
            <p className="mb-6 font-mono text-xs text-fg-muted">{fetchError}</p>
          )}
          <Link
            href={`/dashboard?country=${country.code}&locale=${locale}`}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Link>
        </section>
      </main>
    );
  }

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
