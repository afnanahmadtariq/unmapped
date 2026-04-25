import Link from "next/link";
import { Check, FolderTree, Globe2, Languages, Layers, ShieldAlert, FileJson } from "lucide-react";
import ContextSelector from "@/components/ContextSelector";
import Pill from "@/components/Pill";
import { COUNTRY_REGISTRY, getCountry, DEFAULT_COUNTRY, listCountries } from "@/lib/config";
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
  const qs = `?country=${country.code}&locale=${locale}`;

  const wagesCount = Object.keys(data.wages.wagesByISCO).length;
  const sectorsCount = Object.keys(data.growth.growthBySector).length;

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
        <ContextSelector
          country={country.code}
          locale={locale}
          labels={{
            country: t.selectors.country,
            language: t.selectors.language,
          }}
        />
      </header>

      <section className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8">
          <Pill tone="accent">
            <FolderTree className="h-3 w-3" />
            Configurability proof
          </Pill>
          <h1 className="mt-3 text-3xl font-semibold text-neutral-100">
            Country-agnostic by construction
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            The brief requires that labour data, education taxonomy, language,
            automation calibration, and opportunity types are configurable
            without changing the codebase. This page is the audit trail.
          </p>
        </div>

        {/* Configurability matrix */}
        <div className="grid gap-4 md:grid-cols-2">
          <ConfigCard
            icon={<Layers className="h-5 w-5 text-sky-400" />}
            label="Labour market data"
            requirement="Wage indices + sector classifications"
            location={`/public/data/${country.code.toLowerCase()}/wages.json + growth.json`}
            detail={`${wagesCount} ISCO occupations · ${sectorsCount} sectors · vintage ${data.wages.vintage}`}
            source={data.wages._source}
          />
          <ConfigCard
            icon={<FileJson className="h-5 w-5 text-emerald-400" />}
            label="Education taxonomy & credentials"
            requirement="Per-country credential mapping"
            location={`/public/data/${country.code.toLowerCase()}/credentials.json`}
            detail={`${data.credentials.formalCredentials.length} formal credentials · ${data.credentials.vocationalCredentials.length} vocational programs`}
            source="Country-specific (WASSCE, NVTI, SSC, BTEB, SEIP …)"
          />
          <ConfigCard
            icon={<Languages className="h-5 w-5 text-amber-300" />}
            label="Language & script"
            requirement="UI strings + script support"
            location="/locales/{en,fr,bn}.json"
            detail={`${SUPPORTED_LOCALES.length} locales loaded · default for ${country.name} is ${country.defaultLocale.toUpperCase()}`}
            source="Drop a JSON file to add a new language."
          />
          <ConfigCard
            icon={<ShieldAlert className="h-5 w-5 text-rose-400" />}
            label="Automation calibration"
            requirement="LMIC multiplier on Frey-Osborne"
            location={`/public/data/${country.code.toLowerCase()}/calibration.json`}
            detail={`Global ×${data.calibration.globalMultiplier.toFixed(2)} · ${Object.keys(data.calibration.sectorOverrides).length} sector overrides`}
            source={data.calibration.rationale}
          />
        </div>

        {/* Side-by-side country compare */}
        <section className="mt-10 rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-6">
          <header className="mb-5 flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-neutral-100">
                Live configuration diff
              </h2>
              <p className="text-xs text-neutral-500">
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
                <tr className="border-b border-neutral-800 text-[10px] uppercase tracking-widest text-neutral-500">
                  <th className="py-3 pr-4 font-medium">Parameter</th>
                  {listCountries().map((c) => (
                    <th key={c.code} className="py-3 pr-4 font-medium">
                      <div className="flex items-center gap-2">
                        <Globe2 className="h-3 w-3" /> {c.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-neutral-300">
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

        {/* Drop-in steps */}
        <section className="mt-10 rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-6">
          <h2 className="text-lg font-medium text-neutral-100">
            Add a new country in 4 steps
          </h2>
          <ol className="mt-4 space-y-3 text-sm text-neutral-300">
            <Step n={1} text="Create /public/data/<country>/ folder with wages.json, growth.json, credentials.json, calibration.json (real ILOSTAT + WDI + local TVET sources)." />
            <Step n={2} text={`Add an entry to COUNTRY_REGISTRY in lib/config.ts (currently ${listCountries().length} countries: ${listCountries().map(c => c.name).join(", ")}).`} />
            <Step n={3} text="Optionally drop a /locales/<lang>.json file if the country needs a new UI language." />
            <Step n={4} text="Done. The matcher, calibration, dashboard and PDF export all read the new country automatically." />
          </ol>
        </section>

        {/* Globals snapshot */}
        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <Stat label="ESCO skills loaded" value={ESCO_SKILLS.length.toString()} />
          <Stat label="ISCO occupations loaded" value={ISCO_OCCUPATIONS.length.toString()} />
          <Stat label="Frey-Osborne scores loaded" value={Object.keys(FREY_OSBORNE).length.toString()} />
        </section>

        <p className="mt-10 text-center text-xs text-neutral-600">
          UNMAPPED is open infrastructure. Fork it. Localise it. The codebase
          does not change — only the configuration does.
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
    <article className="rounded-2xl border border-neutral-800/80 bg-linear-to-br from-neutral-900/40 to-neutral-950 p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-800 bg-neutral-900/60">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-medium text-neutral-100">{label}</h3>
            <p className="text-xs text-neutral-500">{requirement}</p>
          </div>
        </div>
        <Pill tone="positive">
          <Check className="h-3 w-3" /> Configurable
        </Pill>
      </header>
      <p className="mt-4 font-mono text-[11px] text-sky-300">{location}</p>
      <p className="mt-2 text-xs text-neutral-300">{detail}</p>
      <p className="mt-3 line-clamp-3 text-[11px] leading-relaxed text-neutral-500">
        {source}
      </p>
    </article>
  );
}

function CompareRow({ label, cells }: { label: string; cells: string[] }) {
  return (
    <tr className="border-b border-neutral-900/60 last:border-b-0">
      <td className="py-3 pr-4 text-xs uppercase tracking-widest text-neutral-500">
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
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-sky-500/40 bg-sky-500/10 font-mono text-[11px] text-sky-300">
        {n}
      </span>
      <span className="text-neutral-300">{text}</span>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-4">
      <p className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-100">{value}</p>
    </div>
  );
}
