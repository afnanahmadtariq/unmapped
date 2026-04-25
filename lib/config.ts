// UNMAPPED — country-agnostic configuration registry.
// Adding a new country = adding one entry here + dropping its data folder. No code changes.

import type { CountryConfig, CountryCode } from "@/types";

export const COUNTRY_REGISTRY: Record<CountryCode, CountryConfig> = {
  GH: {
    code: "GH",
    name: "Ghana",
    defaultLocale: "en",
    currency: "GHS",
    currencySymbol: "GH₵",
    dataPath: "/data/ghana",
    automationCalibration: 0.62, // LMIC adjustment: lower routine-task automation pressure than Frey-Osborne baseline
    credentialMapPath: "/data/ghana/credentials.json",
    context: "urban-informal",
  },
  BD: {
    code: "BD",
    name: "Bangladesh",
    defaultLocale: "bn",
    currency: "BDT",
    currencySymbol: "৳",
    dataPath: "/data/bangladesh",
    automationCalibration: 0.71,
    credentialMapPath: "/data/bangladesh/credentials.json",
    context: "mixed-urban-rural",
  },
};

export const DEFAULT_COUNTRY: CountryCode = "GH";

export function getCountry(code: string): CountryConfig {
  if (code in COUNTRY_REGISTRY) return COUNTRY_REGISTRY[code as CountryCode];
  return COUNTRY_REGISTRY[DEFAULT_COUNTRY];
}

export function listCountries(): CountryConfig[] {
  return Object.values(COUNTRY_REGISTRY);
}
