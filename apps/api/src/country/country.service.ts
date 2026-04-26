import { Injectable } from '@nestjs/common';
import countriesJson from './data/countries.json';
import type { CountryCode, CountryConfig } from '../shared/types';

interface RawCountry {
  code: string;
  iso3: string;
  name: string;
  region: string;
  currency: string;
  currencySymbol: string;
  defaultLocale: string;
  automationCalibration: number;
  context: 'urban-informal' | 'mixed-urban-rural' | 'rural-agricultural';
  snapshot?: boolean;
}

const RAW: RawCountry[] = (countriesJson as { countries: RawCountry[] }).countries;

const REGISTRY: Map<string, CountryConfig> = new Map(
  RAW.map((c) => [
    c.code.toUpperCase(),
    {
      code: c.code.toUpperCase(),
      iso3: c.iso3,
      name: c.name,
      region: c.region,
      defaultLocale: c.defaultLocale,
      currency: c.currency,
      currencySymbol: c.currencySymbol,
      automationCalibration: c.automationCalibration,
      context: c.context,
      hasSnapshot: !!c.snapshot,
    },
  ]),
);

export const DEFAULT_COUNTRY: CountryCode = 'GH';

/**
 * Country registry, ported 1:1 from apps/web/lib/config.ts. The supported list
 * is config-driven (data/countries.json); adding a new country never requires
 * touching this service.
 */
@Injectable()
export class CountryService {
  getOrDefault(code: string | undefined | null): CountryConfig {
    if (!code) return REGISTRY.get(DEFAULT_COUNTRY)!;
    const hit = REGISTRY.get(code.toUpperCase());
    if (hit) return hit;
    return REGISTRY.get(DEFAULT_COUNTRY)!;
  }

  find(code: string): CountryConfig | undefined {
    return REGISTRY.get(code.toUpperCase());
  }

  isSupported(code: string | undefined | null): boolean {
    return !!code && REGISTRY.has(code.toUpperCase());
  }

  list(): CountryConfig[] {
    return Array.from(REGISTRY.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  listByRegion(): Array<{ region: string; countries: CountryConfig[] }> {
    const byRegion = new Map<string, CountryConfig[]>();
    for (const c of this.list()) {
      const arr = byRegion.get(c.region) ?? [];
      arr.push(c);
      byRegion.set(c.region, arr);
    }
    return Array.from(byRegion.entries())
      .map(([region, countries]) => ({ region, countries }))
      .sort((a, b) => a.region.localeCompare(b.region));
  }
}
