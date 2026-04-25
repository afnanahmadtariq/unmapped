import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import bn from "@/locales/bn.json";
import type { LocaleCode } from "@/types";

export type Dictionary = typeof en;

const DICTIONARIES: Record<LocaleCode, Dictionary> = {
  en,
  fr: fr as Dictionary,
  bn: bn as Dictionary,
};

export function getDictionary(locale: string): Dictionary {
  if (locale in DICTIONARIES) return DICTIONARIES[locale as LocaleCode];
  return DICTIONARIES.en;
}

export const SUPPORTED_LOCALES: Array<{ code: LocaleCode; label: string }> = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "bn", label: "বাংলা" },
];

/** Replace {placeholder} segments in a translated string. */
export function fmt(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`
  );
}
