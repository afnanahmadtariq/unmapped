import Link from "next/link";
import Image from "next/image";
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
    <header className="sticky top-0 z-20 border-b border-border-default bg-bg-base/90 backdrop-blur-md">
      {/* Main bar */}
      <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-4 py-2 md:px-6 md:py-2.5">
        {/* Brand */}
        <Link href={`/${qs}`} className="flex shrink-0 items-center">
          <Image
            src="/logo.png"
            alt={t.app.name}
            width={2400}
            height={600}
            className="h-9 w-auto object-contain mix-blend-multiply dark:mix-blend-screen md:h-11"
            priority
          />
        </Link>

        {/* Desktop nav - centred in remaining space */}
        <nav className="hidden flex-1 md:block" aria-label="Main navigation">
          <ul className="flex items-center gap-0.5">
            {NAV.map((item) => {
              const isActive = item.key === active;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href(qs)}
                    className={
                      isActive
                        ? "relative rounded-md px-3 py-1.5 text-xs font-semibold text-fg-primary after:absolute after:inset-x-2 after:-bottom-[1px] after:h-0.5 after:rounded-full after:bg-accent"
                        : "rounded-md px-3 py-1.5 text-xs font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
                    }
                  >
                    {t.nav[item.labelKey]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Right controls */}
        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
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
      </div>

      {/* Mobile nav - underline tab strip */}
      <nav
        className="flex overflow-x-auto border-t border-border-default md:hidden"
        aria-label="Mobile navigation"
      >
        {NAV.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href(qs)}
              className={
                isActive
                  ? "shrink-0 border-b-2 border-accent px-4 py-2 text-[11px] font-semibold text-fg-primary"
                  : "shrink-0 border-b-2 border-transparent px-4 py-2 text-[11px] font-medium text-fg-secondary hover:text-fg-primary"
              }
            >
              {t.nav[item.labelKey]}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
