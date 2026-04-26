import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import bn from "@/locales/bn.json";
import es from "@/locales/es.json";
import ar from "@/locales/ar.json";
import hi from "@/locales/hi.json";
import pt from "@/locales/pt.json";
import zh from "@/locales/zh.json";
import sw from "@/locales/sw.json";
import ur from "@/locales/ur.json";
import de from "@/locales/de.json";
import id from "@/locales/id.json";
import ru from "@/locales/ru.json";
import tr from "@/locales/tr.json";
import vi from "@/locales/vi.json";
import type { LocaleCode } from "@/types";

export type Dictionary = typeof en;

const DICTIONARIES: Record<string, Dictionary> = {
  en,
  fr: fr as Dictionary,
  bn: bn as Dictionary,
  es: es as Dictionary,
  ar: ar as Dictionary,
  hi: hi as Dictionary,
  pt: pt as Dictionary,
  zh: zh as Dictionary,
  sw: sw as Dictionary,
  ur: ur as Dictionary,
  de: de as Dictionary,
  id: id as Dictionary,
  ru: ru as Dictionary,
  tr: tr as Dictionary,
  vi: vi as Dictionary,
};

export function getDictionary(locale: string): Dictionary {
  if (locale in DICTIONARIES) return DICTIONARIES[locale as LocaleCode];
  return DICTIONARIES.en;
}

export const SUPPORTED_LOCALES: Array<{ code: LocaleCode; label: string; rtl?: boolean }> = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "pt", label: "Português" },
  { code: "de", label: "Deutsch" },
  { code: "ru", label: "Русский" },
  { code: "tr", label: "Türkçe" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "zh", label: "中文" },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "sw", label: "Kiswahili" },
  { code: "ar", label: "العربية", rtl: true },
  { code: "ur", label: "اردو", rtl: true },
];

export function isRtl(locale: string): boolean {
  return SUPPORTED_LOCALES.find((l) => l.code === locale)?.rtl === true;
}

export function fmt(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`
  );
}
