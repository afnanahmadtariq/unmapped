import SiteHeader from "@/components/SiteHeader";
import AdminTabs from "@/components/admin/AdminTabs";
import UploadDialog from "@/components/admin/UploadDialog";
import { getCountry, DEFAULT_COUNTRY } from "@/lib/config";
import { getDictionary } from "@/lib/i18n";
import { adminFetch } from "@/lib/adminFetch";
import type { AdminDataSource } from "@/lib/apiClient";

interface PageProps {
  searchParams: Promise<{ country?: string; locale?: string }>;
}

export default async function AdminUploadPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const country = getCountry(sp.country ?? DEFAULT_COUNTRY);
  const locale = sp.locale ?? country.defaultLocale;
  const t = getDictionary(locale);

  const sources = await adminFetch<AdminDataSource[]>("/admin/sources").catch(
    () => [] as AdminDataSource[],
  );

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader countryCode={country.code} locale={locale} active="config" t={t} />
      <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6 md:py-10">
        <AdminTabs />
        <header className="mb-4">
          <h2 className="text-xl font-semibold text-fg-primary">Upload</h2>
          <p className="text-xs text-fg-muted">
            Drop a JSON / NDJSON file against any registered source. Each
            upload becomes a `dataset_runs(kind=upload)` row and follows the
            exact same loader pipeline as the cron-triggered harvesters.
          </p>
        </header>
        <UploadDialog sources={sources} />
      </section>
    </main>
  );
}
