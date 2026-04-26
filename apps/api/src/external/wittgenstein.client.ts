import { Injectable } from '@nestjs/common';
import wittSeed from '../signals/data/wittgenstein.seed.json';
import { CountryService } from '../country/country.service';
import type { CountryCode } from '../shared/types';

export type EducationBucket =
  | 'noEdu'
  | 'primary'
  | 'lowerSec'
  | 'upperSec'
  | 'tertiary';

export interface ProjectionPoint {
  year: 2025 | 2030 | 2035;
  shares: Record<EducationBucket, number>;
}

const BY_COUNTRY = (
  wittSeed as { byCountry: Record<string, Record<string, Record<EducationBucket, number>>> }
).byCountry;

/**
 * Wittgenstein Centre Human Capital Data wrapper. Ported from
 * apps/web/lib/wittgenstein.ts. Today reads the bundled SSP2 snapshot;
 * the full live API integration belongs in the Wittgenstein harvester.
 */
@Injectable()
export class WittgensteinClient {
  constructor(private readonly countries: CountryService) {}

  getProjectionsForCountry(code: CountryCode): ProjectionPoint[] | null {
    const iso3 = this.countries.getOrDefault(code).iso3;
    const block = BY_COUNTRY[iso3];
    if (!block) return null;
    return (['2025', '2030', '2035'] as const).map((y) => ({
      year: Number(y) as 2025 | 2030 | 2035,
      shares: block[y] as Record<EducationBucket, number>,
    }));
  }

  bucketFromEducationLabel(label: string): EducationBucket {
    const l = label.toLowerCase();
    if (l.includes('postgrad') || l.includes('bachelor') || l.includes('diploma'))
      return 'tertiary';
    if (
      l.includes('upper') ||
      l.includes('hsc') ||
      l.includes('wassce') ||
      l.includes('ssc')
    )
      return 'upperSec';
    if (l.includes('lower') || l.includes('jsc') || l.includes('bece'))
      return 'lowerSec';
    if (l.includes('vocational') || l.includes('tvet')) return 'upperSec';
    if (l.includes('primary')) return 'primary';
    return 'noEdu';
  }
}
