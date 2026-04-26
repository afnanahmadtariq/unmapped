"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { isRtl, SUPPORTED_LOCALES } from "@/lib/i18n";

const VALID = new Set(SUPPORTED_LOCALES.map((l) => l.code));

/** Mirrors the `?locale=...` query param onto <html lang> and dir, so screen
 *  readers and CSS direction selectors stay accurate after client navigation. */
export default function HtmlLangSync() {
  const params = useSearchParams();
  const locale = params.get("locale") ?? "en";
  useEffect(() => {
    if (typeof document === "undefined") return;
    const safe = VALID.has(locale) ? locale : "en";
    document.documentElement.lang = safe;
    document.documentElement.dir = isRtl(safe) ? "rtl" : "ltr";
  }, [locale]);
  return null;
}
