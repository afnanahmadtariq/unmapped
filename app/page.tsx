import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Compass,
  Globe2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import ContextSelector from "@/components/ContextSelector";
import Pill from "@/components/Pill";
import { getCountry, DEFAULT_COUNTRY } from "@/lib/config";
import { getDictionary } from "@/lib/i18n";

interface PageProps {
  searchParams: Promise<{ country?: string; locale?: string }>;
}

export default async function LandingPage({ searchParams }: PageProps) {
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
            className="rounded-md px-3 py-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
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
          <Link
            href={`/admin/config${qs}`}
            className="rounded-md px-3 py-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
          >
            Config
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

      <section className="relative mx-auto w-full max-w-6xl px-6 pb-10 pt-20">
        <div className="grid items-center gap-14 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-7">
            <Pill tone="accent">
              <Sparkles className="h-3 w-3" />
              World Bank Youth Summit · Hack-Nation 2026
            </Pill>
            <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-neutral-50 md:text-6xl">
              {t.landing.hero}
            </h1>
            <p className="max-w-2xl text-lg text-neutral-400">
              {t.landing.subhero}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/profile${qs}`}
                className="group inline-flex items-center gap-2 rounded-md bg-linear-to-br from-sky-400 to-sky-500 px-5 py-2.5 font-medium text-neutral-950 shadow-[0_0_40px_-10px_rgba(56,189,248,0.6)] transition hover:brightness-110"
              >
                {t.landing.ctaPrimary}
                <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link
                href={`/dashboard${qs}`}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/40 px-5 py-2.5 font-medium text-neutral-100 transition hover:border-neutral-700 hover:bg-neutral-900"
              >
                <BarChart3 className="h-4 w-4" />
                {t.landing.ctaSecondary}
              </Link>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Pill tone="neutral">
                <ShieldCheck className="h-3 w-3" /> Real ILOSTAT data
              </Pill>
              <Pill tone="neutral">
                <Globe2 className="h-3 w-3" /> Country-agnostic
              </Pill>
              <Pill tone="neutral">
                <Compass className="h-3 w-3" /> ESCO + ISCO grounded
              </Pill>
            </div>
          </div>

          <article className="relative rounded-2xl border border-neutral-800/80 bg-linear-to-br from-neutral-900/60 to-neutral-950 p-6 shadow-[0_0_60px_-30px_rgba(56,189,248,0.4)]">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-400">
                {t.landing.amaraTitle}
              </p>
              <Pill tone="accent">{country.name}</Pill>
            </div>
            <p className="mt-4 text-base leading-relaxed text-neutral-200">
              {t.landing.amaraStory}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3 text-[11px]">
              <Stat label="Active" value={country.name} />
              <Stat
                label="Economy"
                value={country.context.replace("-", " ")}
              />
              <Stat
                label="Calibration"
                value={`×${country.automationCalibration.toFixed(2)}`}
              />
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-500">
          The system
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-neutral-100">
          Three failures. One open infrastructure layer.
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Feature
            icon={<Compass className="h-5 w-5 text-sky-400" />}
            title="Skills Signal Engine"
            body="Map informal experience to ESCO + ISCO codes that travel across borders. Portable JSON + PDF export."
            cta={{ href: `/profile${qs}`, label: "Open Module 01" }}
          />
          <Feature
            icon={<Sparkles className="h-5 w-5 text-emerald-400" />}
            title="Opportunity Matching"
            body="Real wage and growth signals on every match. Formal · self-employment · gig · training. AI risk calibrated for LMIC context."
            cta={{ href: `/opportunities${qs}`, label: "Open Module 03" }}
          />
          <Feature
            icon={<BarChart3 className="h-5 w-5 text-amber-300" />}
            title="Policymaker dashboard"
            body="Sector growth, wage distribution, automation calibration. Snapshot CSV export for program officers."
            cta={{ href: `/dashboard${qs}`, label: "Open dashboard" }}
          />
        </div>
      </section>

      <footer className="border-t border-neutral-900 px-6 py-6 text-xs text-neutral-500">
        <p>
          Data sources: ESCO · ISCO-08 · ILOSTAT · World Bank WDI · Frey-Osborne ·
          ILO Future of Work · Wittgenstein Centre. Built as open infrastructure —
          no country hardcoded.
        </p>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/30 px-3 py-2">
      <p className="text-[9px] uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-neutral-200 capitalize">{value}</p>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <article className="group rounded-2xl border border-neutral-800/80 bg-linear-to-br from-neutral-900/40 to-neutral-950 p-5 transition hover:border-neutral-700">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900/60">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-medium text-neutral-100">{title}</h3>
      <p className="mt-2 text-sm text-neutral-400">{body}</p>
      <Link
        href={cta.href}
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300"
      >
        {cta.label}
        <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </article>
  );
}
