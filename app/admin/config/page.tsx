import { Check, FolderTree, Globe2, Languages, Layers, ShieldAlert, FileJson } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import Pill from "@/components/Pill";
import { getCountry, DEFAULT_COUNTRY, listCountries } from "@/lib/config";
import { getDictionary, SUPPORTED_LOCALES } from "@/lib/i18n";
import { getCountryData, ESCO_SKILLS, ISCO_OCCUPATIONS, FREY_OSBORNE } from "@/lib/data";

interface PageProps {
  searchParams: Promise<{ country?: string; locale?: string }>;
}

export default async function AdminConfigPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const country = getCountry(sp.country ?? DEFAULT_COUNTRY);
  const locale = sp.locale ?? country.defaultLocale;
  const t = getDictionary(locale);
  const data = getCountryData(country.code);

  const wagesCount = Object.keys(data.wages.wagesByISCO).length;
  const sectorsCount = Object.keys(data.growth.growthBySector).length;

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader
        countryCode={country.code}
        locale={locale}
        active="config"
        labels={{ country: t.selectors.country, language: t.selectors.language }}
      />

      <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8">
          <Pill tone="accent">
            <FolderTree className="h-3 w-3" />
            Configurability proof
          </Pill>
          <h1 className="mt-3 text-3xl font-semibold text-fg-primary">
            Country-agnostic by construction
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-fg-secondary">
            The brief requires that labour data, education taxonomy, language,
            automation calibration, and opportunity types are configurable
            without changing the codebase. This page is the audit trail.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ConfigCard
            icon={<Layers className="h-5 w-5 text-accent" />}
            label="Labour market data"
            requirement="Wage indices + sector classifications"
            location={`/public/data/${country.code.toLowerCase()}/wages.json + growth.json`}
            detail={`${wagesCount} ISCO occupations · ${sectorsCount} sectors · vintage ${data.wages.vintage}`}
            source={data.wages._source}
          />
          <ConfigCard
            icon={<FileJson className="h-5 w-5 text-positive" />}
            label="Education taxonomy and credentials"
            requirement="Per-country credential mapping"
            location={`/public/data/${country.code.toLowerCase()}/credentials.json`}
            detail={`${data.credentials.formalCredentials.length} formal credentials · ${data.credentials.vocationalCredentials.length} vocational programs`}
            source="Country-specific (WASSCE, NVTI, SSC, BTEB, SEIP, ...)"
          />
          <ConfigCard
            icon={<Languages className="h-5 w-5 text-warning" />}
            label="Language and script"
            requirement="UI strings + script support"
            location="/locales/{en,fr,bn}.json"
            detail={`${SUPPORTED_LOCALES.length} locales loaded · default for ${country.name} is ${country.defaultLocale.toUpperCase()}`}
            source="Drop a JSON file to add a new language."
          />
          <ConfigCard
            icon={<ShieldAlert className="h-5 w-5 text-danger" />}
            label="Automation calibration"
            requirement="LMIC multiplier on Frey-Osborne"
            location={`/public/data/${country.code.toLowerCase()}/calibration.json`}
            detail={`Global ×${data.calibration.globalMultiplier.toFixed(2)} · ${Object.keys(data.calibration.sectorOverrides).length} sector overrides`}
            source={data.calibration.rationale}
          />
        </div>

        <section className="mt-10 rounded-2xl border border-border-default bg-bg-raised p-6">
          <header className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-fg-primary">
                Live configuration diff
              </h2>
              <p className="text-xs text-fg-muted">
                Same codebase. Different configuration objects. No rebuild required.
              </p>
            </div>
            <Pill tone="positive">
              <Check className="h-3 w-3" /> Drop-in country support
            </Pill>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b border-border-default text-[10px] uppercase tracking-widest text-fg-muted">
                  <th className="py-3 pr-4 font-medium">Parameter</th>
                  {listCountries().map((c) => (
                    <th key={c.code} className="py-3 pr-4 font-medium">
                      <div className="flex items-center gap-2 text-fg-secondary">
                        <Globe2 className="h-3 w-3" /> {c.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-fg-secondary">
                <CompareRow label="Country code" cells={listCountries().map((c) => c.code)} />
                <CompareRow label="Default locale" cells={listCountries().map((c) => c.defaultLocale.toUpperCase())} />
                <CompareRow label="Currency" cells={listCountries().map((c) => `${c.currencySymbol} ${c.currency}`)} />
                <CompareRow label="Economy context" cells={listCountries().map((c) => c.context.replace("-", " "))} />
                <CompareRow
                  label="Automation multiplier"
                  cells={listCountries().map((c) => `×${c.automationCalibration.toFixed(2)}`)}
                />
                <CompareRow
                  label="Data path"
                  cells={listCountries().map((c) => c.dataPath)}
                />
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-border-default bg-bg-raised p-6">
          <h2 className="text-lg font-medium text-fg-primary">
            Add a new country in 4 steps
          </h2>
          <ol className="mt-4 space-y-3 text-sm text-fg-secondary">
            <Step n={1} text="Create /public/data/<country>/ folder with wages.json, growth.json, credentials.json, calibration.json (real ILOSTAT + WDI + local TVET sources)." />
            <Step n={2} text={`Add an entry to COUNTRY_REGISTRY in lib/config.ts (currently ${listCountries().length} countries: ${listCountries().map(c => c.name).join(", ")}).`} />
            <Step n={3} text="Optionally drop a /locales/<lang>.json file if the country needs a new UI language." />
            <Step n={4} text="Done. The matcher, calibration, dashboard, and PDF export all read the new country automatically." />
          </ol>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <Stat label="ESCO skills loaded" value={ESCO_SKILLS.length.toString()} />
          <Stat label="ISCO occupations loaded" value={ISCO_OCCUPATIONS.length.toString()} />
          <Stat label="Frey-Osborne scores loaded" value={Object.keys(FREY_OSBORNE).length.toString()} />
        </section>

        <p className="mt-10 text-center text-xs text-fg-muted">
          UNMAPPED is open infrastructure. Fork it. Localise it. The codebase
          does not change, only the configuration does.
        </p>
      </section>
    </main>
  );
}

function ConfigCard({
  icon,
  label,
  requirement,
  location,
  detail,
  source,
}: {
  icon: React.ReactNode;
  label: string;
  requirement: string;
  location: string;
  detail: string;
  source: string;
}) {
  return (
    <article className="rounded-2xl border border-border-default bg-bg-raised p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-border-default bg-bg-base">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-medium text-fg-primary">{label}</h3>
            <p className="text-xs text-fg-muted">{requirement}</p>
          </div>
        </div>
        <Pill tone="positive">
          <Check className="h-3 w-3" /> Configurable
        </Pill>
      </header>
      <p className="mt-4 font-mono text-[11px] text-accent">{location}</p>
      <p className="mt-2 text-xs text-fg-secondary">{detail}</p>
      <p className="mt-3 line-clamp-3 text-[11px] leading-relaxed text-fg-muted">
        {source}
      </p>
    </article>
  );
}

function CompareRow({ label, cells }: { label: string; cells: string[] }) {
  return (
    <tr className="border-b border-border-default last:border-b-0">
      <td className="py-3 pr-4 text-xs uppercase tracking-widest text-fg-muted">
        {label}
      </td>
      {cells.map((c, i) => (
        <td key={i} className="py-3 pr-4 capitalize">
          {c}
        </td>
      ))}
    </tr>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-accent/40 bg-accent/10 font-mono text-[11px] text-accent">
        {n}
      </span>
      <span className="text-fg-secondary">{text}</span>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-bg-raised p-4">
      <p className="text-[10px] uppercase tracking-widest text-fg-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-fg-primary">{value}</p>
    </div>
  );
}
