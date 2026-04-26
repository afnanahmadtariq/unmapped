import Link from "next/link";
import ContextSelector from "@/components/ContextSelector";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import type { Dictionary } from "@/lib/i18n";

interface Props {
  countryCode: string;
  locale: string;
  active?: "profile" | "opportunities" | "dashboard" | "config" | "api" | "home";
  t: Dictionary;
}

const NAV: Array<{
  key: NonNullable<Props["active"]>;
  labelKey: keyof Dictionary["nav"];
  href: (qs: string) => string;
}> = [
  { key: "profile", labelKey: "profile", href: (q) => `/profile${q}` },
  { key: "opportunities", labelKey: "opportunities", href: (q) => `/opportunities${q}` },
  { key: "dashboard", labelKey: "dashboard", href: (q) => `/dashboard${q}` },
  { key: "config", labelKey: "config", href: (q) => `/admin/config${q}` },
  { key: "api", labelKey: "api", href: (q) => `/api-docs${q}` },
];

export default function SiteHeader({ countryCode, locale, active = "home", t }: Props) {
  const qs = `?country=${countryCode}&locale=${locale}`;
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border-default bg-bg-base/80 px-4 py-3 backdrop-blur-md md:px-6 md:py-4">
      <Link
        href={`/${qs}`}
        className="flex items-center gap-2 text-base font-semibold tracking-wide md:text-lg"
      >
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent font-mono text-[10px] font-bold text-white">
          UM
        </span>
        <span className="text-fg-primary">{t.app.name}</span>
      </Link>

      <nav className="order-3 -mx-4 flex w-full overflow-x-auto border-t border-border-default px-4 py-2 text-xs md:order-2 md:mx-0 md:w-auto md:border-0 md:p-0">
        <ul className="flex gap-1">
          {NAV.map((item) => {
            const isActive = item.key === active;
            return (
              <li key={item.key}>
                <Link
                  href={item.href(qs)}
                  className={
                    isActive
                      ? "rounded-md bg-bg-hover px-3 py-1.5 text-fg-primary"
                      : "rounded-md px-3 py-1.5 text-fg-secondary hover:bg-bg-hover hover:text-fg-primary"
                  }
                >
                  {t.nav[item.labelKey]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="order-2 flex items-center gap-2 md:order-3">
        <ContextSelector
          country={countryCode}
          locale={locale}
          labels={{
            country: t.selectors.country,
            language: t.selectors.language,
          }}
        />
        <ThemeToggle />
        <AccountMenu qs={qs} />
      </div>
    </header>
  );
}
