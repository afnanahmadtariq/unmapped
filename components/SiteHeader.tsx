import Link from "next/link";
import ContextSelector from "@/components/ContextSelector";
import ThemeToggle from "@/components/ThemeToggle";

interface Props {
  countryCode: string;
  locale: string;
  active?: "profile" | "opportunities" | "dashboard" | "config" | "home";
  labels: { country: string; language: string };
}

const NAV: Array<{ key: NonNullable<Props["active"]>; label: string; href: (qs: string) => string }> = [
  { key: "profile", label: "Skills profile", href: (q) => `/profile${q}` },
  { key: "opportunities", label: "Opportunities", href: (q) => `/opportunities${q}` },
  { key: "dashboard", label: "Dashboard", href: (q) => `/dashboard${q}` },
  { key: "config", label: "Config", href: (q) => `/admin/config${q}` },
];

export default function SiteHeader({ countryCode, locale, active = "home", labels }: Props) {
  const qs = `?country=${countryCode}&locale=${locale}`;
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border-default bg-bg-base/80 px-4 py-3 backdrop-blur-md md:px-6 md:py-4">
      <Link
        href={`/${qs}`}
        className="flex items-center gap-2 text-base font-semibold tracking-wide md:text-lg"
      >
        <span className="grid h-7 w-7 place-items-center rounded-md bg-accent font-mono text-[10px] font-bold text-white">
          UM
        </span>
        <span className="text-fg-primary">UNMAPPED</span>
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
                  {item.label}
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
          labels={labels}
        />
        <ThemeToggle />
      </div>
    </header>
  );
}
