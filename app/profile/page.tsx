import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import ProfileWizard from "@/components/ProfileWizard";
import Pill from "@/components/Pill";
import { getCountry, DEFAULT_COUNTRY } from "@/lib/config";
import { getDictionary } from "@/lib/i18n";

interface PageProps {
  searchParams: Promise<{ country?: string; locale?: string }>;
}

export default async function ProfilePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const country = getCountry(sp.country ?? DEFAULT_COUNTRY);
  const locale = sp.locale ?? country.defaultLocale;
  const t = getDictionary(locale);
  const qs = `?country=${country.code}&locale=${locale}`;

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader countryCode={country.code} locale={locale} active="profile" t={t} />

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Pill tone="accent">
              <Sparkles className="h-3 w-3" />
              {t.profile.moduleEyebrow}
            </Pill>
            <h1 className="mt-3 text-3xl font-semibold text-fg-primary">
              {t.profile.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-fg-secondary">
              {t.profile.subtitle}
            </p>
          </div>
          <Link
            href={`/opportunities${qs}`}
            className="inline-flex items-center gap-2 rounded-md border border-border-default bg-bg-raised px-4 py-2 text-xs text-fg-secondary hover:bg-bg-hover"
          >
            {t.profile.skipToOpportunities}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <ProfileWizard
          countryCode={country.code}
          countryName={country.name}
          locale={locale}
          t={t}
          opportunitiesHref={`/opportunities${qs}`}
        />
      </section>
    </main>
  );
}
