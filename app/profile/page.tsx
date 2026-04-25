import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import ContextSelector from "@/components/ContextSelector";
import ProfileWorkbench from "@/components/ProfileWorkbench";
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
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-neutral-900 bg-neutral-950/70 px-6 py-4 backdrop-blur">
        <Link
          href={`/${qs}`}
          className="flex items-center gap-2 text-lg font-semibold tracking-wide"
        >
          <span className="grid h-7 w-7 place-items-center rounded-md bg-linear-to-br from-sky-400 to-emerald-400 font-mono text-[10px] font-bold text-neutral-950">
            UM
          </span>
          <span className="text-neutral-100">UNMAPPED</span>
        </Link>
        <nav className="hidden items-center gap-1 text-xs md:flex">
          <Link
            href={`/profile${qs}`}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-neutral-100"
          >
            Skills profile
          </Link>
          <Link
            href={`/opportunities${qs}`}
            className="rounded-md px-3 py-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
          >
            Opportunities
          </Link>
          <Link
            href={`/dashboard${qs}`}
            className="rounded-md px-3 py-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
          >
            Dashboard
          </Link>
        </nav>
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
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Pill tone="accent">
              <Sparkles className="h-3 w-3" />
              Module 01 · Skills Signal Engine
            </Pill>
            <h1 className="mt-3 text-3xl font-semibold text-neutral-100">
              {t.profile.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-400">
              Mapped to ESCO (EU Skills Taxonomy) and ISCO-08 (ILO). Your
              profile is portable across borders and sectors — and explainable
              to you, not just to an algorithm.
            </p>
          </div>
          <Link
            href={`/opportunities${qs}`}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/40 px-4 py-2 text-xs text-neutral-300 hover:bg-neutral-900"
          >
            Skip to opportunities
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <ProfileWorkbench
          countryCode={country.code}
          countryName={country.name}
          locale={locale}
          labels={t.profile}
          opportunitiesHref={`/opportunities${qs}`}
        />
      </section>
    </main>
  );
}
