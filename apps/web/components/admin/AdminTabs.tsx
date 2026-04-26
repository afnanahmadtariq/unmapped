"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { id: "overview", label: "Overview", href: "/admin/config" },
  { id: "sources", label: "Sources", href: "/admin/config/sources" },
  { id: "runs", label: "Runs", href: "/admin/config/runs" },
  { id: "upload", label: "Upload", href: "/admin/config/upload" },
];

export default function AdminTabs() {
  const pathname = usePathname() ?? "/admin/config";
  const search = useSearchParams();
  const country = search?.get("country");
  const locale = search?.get("locale");
  const qs = new URLSearchParams();
  if (country) qs.set("country", country);
  if (locale) qs.set("locale", locale);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-border-default text-sm">
      {TABS.map((t) => {
        const active =
          t.href === "/admin/config"
            ? pathname === "/admin/config"
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.id}
            href={`${t.href}${suffix}`}
            className={clsx(
              "rounded-t-lg px-4 py-2 transition",
              active
                ? "border border-border-default border-b-bg-raised bg-bg-raised text-fg-primary"
                : "text-fg-muted hover:text-fg-secondary",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
