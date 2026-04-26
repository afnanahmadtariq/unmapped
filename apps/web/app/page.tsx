import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Compass,
  Globe2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
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
      <SiteHeader countryCode={country.code} locale={locale} active="home" t={t} />

      <section className="relative mx-auto w-full max-w-6xl px-6 pb-12 pt-12 md:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <Pill tone="accent">
              <Sparkles className="h-3 w-3" />
              {t.landing.eyebrow}
            </Pill>
            <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
              {t.landing.hero}
            </h1>
            <p className="max-w-2xl text-lg text-fg-secondary">
              {t.landing.subhero}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/profile${qs}`}
                className="group inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:bg-accent-strong"
              >
                {t.landing.ctaPrimary}
                <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link
                href={`/dashboard${qs}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-bg-raised px-5 py-2.5 font-medium text-fg-primary transition hover:border-border-strong hover:bg-bg-hover"
              >
                <BarChart3 className="h-4 w-4" />
                {t.landing.ctaSecondary}
              </Link>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Pill tone="neutral">
                <ShieldCheck className="h-3 w-3" /> {t.landing.trustReal}
              </Pill>
              <Pill tone="neutral">
                <Globe2 className="h-3 w-3" /> {t.landing.trustAgnostic}
              </Pill>
              <Pill tone="neutral">
                <Compass className="h-3 w-3" /> {t.landing.trustGrounded}
              </Pill>
            </div>
          </div>

          <article className="relative rounded-2xl border border-border-default bg-bg-raised p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">
                {t.landing.amaraTitle}
              </p>
              <Pill tone="accent">{country.name}</Pill>
            </div>
            <p className="mt-4 text-base leading-relaxed text-fg-primary">
              {t.landing.amaraStory}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3 text-[11px]">
              <Stat label={t.landing.statActive} value={country.name} />
              <Stat
                label={t.landing.statEconomy}
                value={country.context.replace("-", " ")}
              />
              <Stat
                label={t.landing.statCalibration}
                value={`×${country.automationCalibration.toFixed(2)}`}
              />
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.25em] text-fg-muted">
          {t.landing.sectionEyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">
          {t.landing.sectionTitle}
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Feature
            icon={<Compass className="h-5 w-5 text-accent" />}
            title={t.landing.feature1Title}
            body={t.landing.feature1Body}
            cta={{ href: `/profile${qs}`, label: t.landing.feature1Cta }}
          />
          <Feature
            icon={<Sparkles className="h-5 w-5 text-positive" />}
            title={t.landing.feature2Title}
            body={t.landing.feature2Body}
            cta={{ href: `/opportunities${qs}`, label: t.landing.feature2Cta }}
          />
          <Feature
            icon={<BarChart3 className="h-5 w-5 text-warning" />}
            title={t.landing.feature3Title}
            body={t.landing.feature3Body}
            cta={{ href: `/dashboard${qs}`, label: t.landing.feature3Cta }}
          />
        </div>
      </section>

      <footer className="border-t border-border-default px-6 py-6 text-xs text-fg-muted">
        <p>{t.landing.footer}</p>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-base px-3 py-2">
      <p className="text-[9px] uppercase tracking-widest text-fg-muted">
        {label}
      </p>
      <p className="mt-1 text-fg-primary capitalize">{value}</p>
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
    <article className="group rounded-2xl border border-border-default bg-bg-raised p-5 transition hover:border-border-strong hover:shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-default bg-bg-base">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-medium text-fg-primary">{title}</h3>
      <p className="mt-2 text-sm text-fg-secondary">{body}</p>
      <Link
        href={cta.href}
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-strong"
      >
        {cta.label}
        <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </article>
  );
}
