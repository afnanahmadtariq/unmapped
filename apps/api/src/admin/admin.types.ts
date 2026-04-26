export interface SnapshotCountrySummary {
  code: string;
  name: string;
  region: string;
  defaultLocale: string;
  currency: string;
  currencySymbol: string;
  automationCalibration: number;
  context: string;
}

export interface AdminConfigSummary {
  countryCode: string;
  wagesCount: number;
  sectorsCount: number;
  vintage: string;
  calibrationMultiplier: number;
  calibrationOverridesCount: number;
  calibrationRationale: string;
  formalCredentialsCount: number;
  vocationalCredentialsCount: number;
  credentialsSource: string;
  escoCount: number;
  iscoCount: number;
  freyCount: number;
  snapshotCountries: SnapshotCountrySummary[];
}
