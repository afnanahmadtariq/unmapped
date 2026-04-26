import SiteHeader from "@/components/SiteHeader";
import AdminTabs from "@/components/admin/AdminTabs";
import RunTable from "@/components/admin/RunTable";
import { getCountry, DEFAULT_COUNTRY } from "@/lib/config";
import { getDictionary } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import type { AdminDataRun } from "@/lib/apiClient";

interface PageProps {
  searchParams: Promise<{ country?: string; locale?: string }>;
}

export default async function AdminRunsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const country = getCountry(sp.country ?? DEFAULT_COUNTRY);
  const locale = sp.locale ?? country.defaultLocale;
  const t = getDictionary(locale);

  const runs = await adminFetch<AdminDataRun[]>("/admin/runs?limit=100").catch(
    () => [] as AdminDataRun[],
  );

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader countryCode={country.code} locale={locale} active="config" t={t} />
      <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6 md:py-10">
        <AdminTabs />
        <header className="mb-4">
          <h2 className="text-xl font-semibold text-fg-primary">Runs</h2>
          <p className="text-xs text-fg-muted">
            Every harvest tick + admin upload writes one row here. Deleting a
            run cascades to every Postgres row, Milvus vector and JSON archive
            tagged with that runId.
          </p>
        </header>
        <RunTable initial={runs} />
      </section>
    </main>
  );
}
