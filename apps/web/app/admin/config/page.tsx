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
  const snapshotCountries = listCountries().filter((c) => c.hasSnapshot);

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader countryCode={country.code} locale={locale} active="config" t={t} />

      <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8">
          <Pill tone="accent">
            <FolderTree className="h-3 w-3" />
            {t.admin.moduleEyebrow}
          </Pill>
          <h1 className="mt-3 text-3xl font-semibold text-fg-primary">
            {t.admin.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-fg-secondary">
            {t.admin.subtitle}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ConfigCard
            icon={<Layers className="h-5 w-5 text-accent" />}
            label={t.admin.labourTitle}
            requirement={t.admin.labourReq}
            location={`/public/data/${country.code.toLowerCase()}/wages.json + growth.json`}
            detail={`${wagesCount} ISCO · ${sectorsCount} sectors · vintage ${data.wages.vintage}`}
            source={data.wages._source}
            configurableLabel={t.admin.configurable}
          />
          <ConfigCard
            icon={<FileJson className="h-5 w-5 text-positive" />}
            label={t.admin.credTitle}
            requirement={t.admin.credReq}
            location={`/public/data/${country.code.toLowerCase()}/credentials.json`}
            detail={`${data.credentials.formalCredentials.length} formal · ${data.credentials.vocationalCredentials.length} vocational`}
            source="WASSCE, NVTI, SSC, BTEB, SEIP, ..."
            configurableLabel={t.admin.configurable}
          />
          <ConfigCard
            icon={<Languages className="h-5 w-5 text-warning" />}
            label={t.admin.langTitle}
            requirement={t.admin.langReq}
            location="/locales/{en,fr,bn}.json"
            detail={`${SUPPORTED_LOCALES.length} locales · default ${country.defaultLocale.toUpperCase()}`}
            source="Drop-in JSON file."
            configurableLabel={t.admin.configurable}
          />
          <ConfigCard
            icon={<ShieldAlert className="h-5 w-5 text-danger" />}
            label={t.admin.calibTitle}
            requirement={t.admin.calibReq}
            location={`/public/data/${country.code.toLowerCase()}/calibration.json`}
            detail={`Global ×${data.calibration.globalMultiplier.toFixed(2)} · ${Object.keys(data.calibration.sectorOverrides).length} overrides`}
            source={data.calibration.rationale}
            configurableLabel={t.admin.configurable}
          />
        </div>

        <section className="mt-10 rounded-2xl border border-border-default bg-bg-raised p-6 shadow-sm">
          <header className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-fg-primary">{t.admin.diffTitle}</h2>
              <p className="text-xs text-fg-muted">{t.admin.diffSub}</p>
            </div>
            <Pill tone="positive">
              <Check className="h-3 w-3" /> {t.admin.dropIn}
            </Pill>
          </header>
          <p className="mb-3 text-xs text-fg-muted">
            Showing {snapshotCountries.length} curated-snapshot countries. The system supports
            <strong className="mx-1 font-mono text-accent">{listCountries().length}</strong>
            ISO countries total via the live World Bank fallback.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b border-border-default text-[10px] uppercase tracking-widest text-fg-muted">
                  <th className="py-3 pr-4 font-medium">Parameter</th>
                  {snapshotCountries.map((c) => (
                    <th key={c.code} className="py-3 pr-4 font-medium">
                      <div className="flex items-center gap-2 text-fg-secondary">
                        <Globe2 className="h-3 w-3" /> {c.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-fg-secondary">
                <CompareRow label="Country code" cells={snapshotCountries.map((c) => c.code)} />
                <CompareRow label="Region" cells={snapshotCountries.map((c) => c.region)} />
                <CompareRow label="Default locale" cells={snapshotCountries.map((c) => c.defaultLocale.toUpperCase())} />
                <CompareRow label="Currency" cells={snapshotCountries.map((c) => `${c.currencySymbol} ${c.currency}`)} />
                <CompareRow label="Economy context" cells={snapshotCountries.map((c) => c.context.replace("-", " "))} />
                <CompareRow
                  label="Automation multiplier"
                  cells={snapshotCountries.map((c) => `×${c.automationCalibration.toFixed(2)}`)}
                />
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-border-default bg-bg-raised p-6 shadow-sm">
          <h2 className="text-lg font-medium text-fg-primary">{t.admin.stepsTitle}</h2>
          <ol className="mt-4 space-y-3 text-sm text-fg-secondary">
            <Step n={1} text={t.admin.step1} />
            <Step n={2} text={t.admin.step2} />
            <Step n={3} text={t.admin.step3} />
            <Step n={4} text={t.admin.step4} />
          </ol>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <Stat label={t.admin.statEsco} value={ESCO_SKILLS.length.toString()} />
          <Stat label={t.admin.statIsco} value={ISCO_OCCUPATIONS.length.toString()} />
          <Stat label={t.admin.statFrey} value={Object.keys(FREY_OSBORNE).length.toString()} />
        </section>

        <p className="mt-10 text-center text-xs text-fg-muted">{t.admin.footer}</p>
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
  configurableLabel,
}: {
  icon: React.ReactNode;
  label: string;
  requirement: string;
  location: string;
  detail: string;
  source: string;
  configurableLabel: string;
}) {
  return (
    <article className="rounded-2xl border border-border-default bg-bg-raised p-5 shadow-sm">
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
          <Check className="h-3 w-3" /> {configurableLabel}
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
    <div className="rounded-xl border border-border-default bg-bg-raised p-4 shadow-sm">
      <p className="text-[10px] uppercase tracking-widest text-fg-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-fg-primary">{value}</p>
    </div>
  );
}
