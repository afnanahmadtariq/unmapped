import { Injectable } from '@nestjs/common';
import { CountryService } from '../country/country.service';
import { SignalsService } from '../signals/signals.service';
import { EscoService } from '../taxonomies/esco/esco.service';
import { IscoService } from '../taxonomies/isco/isco.service';
import { AdminConfigSummary } from './admin.types';
import type { CountryCode } from '../shared/types';

// Credentials seed data — one file per snapshot country
import ghCredentials from '../signals/data/ghana/credentials.json';
import bdCredentials from '../signals/data/bangladesh/credentials.json';
import keCredentials from '../signals/data/kenya/credentials.json';

interface CredentialEntry {
  formalCredentials: {
    name: string;
    abbreviation: string;
    iscedLevel: number;
    equivalentTo: string;
  }[];
  vocationalCredentials: {
    name: string;
    issuer?: string;
    iscoMapping?: string[];
  }[];
  _source: string;
}

const CREDENTIALS: Record<string, CredentialEntry> = {
  GH: ghCredentials,
  BD: bdCredentials,
  KE: keCredentials,
};

const GENERIC_CREDENTIALS: CredentialEntry = {
  _source: 'Generic ISCED ladder.',
  formalCredentials: [
    {
      name: 'Lower secondary',
      abbreviation: 'LSec',
      iscedLevel: 2,
      equivalentTo: 'ISCED 2',
    },
    {
      name: 'Upper secondary',
      abbreviation: 'USec',
      iscedLevel: 3,
      equivalentTo: 'ISCED 3',
    },
    {
      name: 'Vocational / TVET',
      abbreviation: 'TVET',
      iscedLevel: 4,
      equivalentTo: 'ISCED 4',
    },
    {
      name: 'Short-cycle tertiary',
      abbreviation: 'Dip',
      iscedLevel: 5,
      equivalentTo: 'ISCED 5',
    },
    {
      name: "Bachelor's",
      abbreviation: 'BA',
      iscedLevel: 6,
      equivalentTo: 'ISCED 6',
    },
  ],
  vocationalCredentials: [
    {
      name: 'Generic vocational certificate',
      issuer: 'Local TVET authority',
      iscoMapping: ['7421', '7231', '7411'],
    },
  ],
};

@Injectable()
export class AdminService {
  constructor(
    private readonly countries: CountryService,
    private readonly signals: SignalsService,
    private readonly esco: EscoService,
    private readonly isco: IscoService,
  ) {}

  async getConfigSummary(
    countryCode: CountryCode,
  ): Promise<AdminConfigSummary> {
    const cc = countryCode.toUpperCase();
    const [snapshot, escoCount, allIsco] = await Promise.all([
      this.signals.getCountrySnapshot(cc),
      this.esco.count(),
      this.isco.findAll(),
    ]);

    const cred = CREDENTIALS[cc] ?? GENERIC_CREDENTIALS;
    const snapshotCountries = this.countries
      .list()
      .filter((c) => c.hasSnapshot)
      .map((c) => ({
        code: c.code,
        name: c.name,
        region: c.region,
        defaultLocale: c.defaultLocale,
        currency: c.currency,
        currencySymbol: c.currencySymbol,
        automationCalibration: c.automationCalibration,
        context: c.context,
      }));

    return {
      countryCode: cc,
      wagesCount: Object.keys(snapshot.wagesByIsco).length,
      sectorsCount: Object.keys(snapshot.growthBySector).length,
      vintage: snapshot.calibration.rationale.includes('synthesised')
        ? 'synthesised-2024'
        : '2024',
      calibrationMultiplier: snapshot.calibration.globalMultiplier,
      calibrationOverridesCount: Object.keys(
        snapshot.calibration.sectorOverrides,
      ).length,
      calibrationRationale: snapshot.calibration.rationale,
      formalCredentialsCount: cred.formalCredentials.length,
      vocationalCredentialsCount: cred.vocationalCredentials.length,
      credentialsSource: cred._source,
      escoCount,
      iscoCount: allIsco.length,
      freyCount: await this.signals.freyOsborneCount(),
      snapshotCountries,
    };
  }
}
