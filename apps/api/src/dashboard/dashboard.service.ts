import { Injectable } from '@nestjs/common';
import { CountryService } from '../country/country.service';
import { SignalsService } from '../signals/signals.service';
import { IscoService } from '../taxonomies/isco/isco.service';
import { WorldBankApiClient } from '../external/world-bank.client';
import {
  DashboardSnapshot,
  SectorRisk,
  WittgensteinPoint,
  WittgensteinShares,
} from './dashboard.types';
import type { CountryCode } from '../shared/types';
import wittSeed from '../signals/data/wittgenstein.seed.json';

// snapshot data (for minimumWage / informalEmploymentShare fallbacks)
import ghWages from '../signals/data/ghana/wages.json';
import ghGrowth from '../signals/data/ghana/growth.json';
import bdWages from '../signals/data/bangladesh/wages.json';
import bdGrowth from '../signals/data/bangladesh/growth.json';
import keWages from '../signals/data/kenya/wages.json';
import keGrowth from '../signals/data/kenya/growth.json';

const WAGES_SNAP: Record<string, typeof ghWages> = {
  GH: ghWages,
  BD: bdWages,
  KE: keWages,
};
const GROWTH_SNAP: Record<string, typeof ghGrowth> = {
  GH: ghGrowth,
  BD: bdGrowth,
  KE: keGrowth,
};

const WITT_BY_COUNTRY = (
  wittSeed as {
    byCountry: Record<string, Record<string, Record<string, number>>>;
  }
).byCountry;

@Injectable()
export class DashboardService {
  constructor(
    private readonly countries: CountryService,
    private readonly signals: SignalsService,
    private readonly isco: IscoService,
    private readonly wb: WorldBankApiClient,
  ) {}

  async getSnapshot(countryCode: CountryCode): Promise<DashboardSnapshot> {
    const cc = countryCode.toUpperCase();
    const country = this.countries.getOrDefault(cc);
    const iso3 = country.iso3;

    const [snapshot, allIsco, liveWb] = await Promise.all([
      this.signals.getCountrySnapshot(cc),
      this.isco.findAll(),
      this.wb.fetchIndicators(iso3, [
        'YOUTH_UNEMPLOYMENT',
        'GDP_PCAP',
        'INTERNET_USERS',
      ]),
    ]);

    // minimumWage and informalEmploymentShare come from the snapshot JSON seed
    // (the DB currently does not store them as separate columns).
    const wagesSnap = WAGES_SNAP[cc];
    const growthSnap = GROWTH_SNAP[cc];
    const minimumWage =
      wagesSnap?.minimumWage ??
      Math.round(
        (WAGES_SNAP.GH?.minimumWage ?? 0) *
          (1 + country.automationCalibration * 1.5),
      );
    const informalEmploymentShare =
      growthSnap?.informalEmploymentShare ??
      GROWTH_SNAP.GH?.informalEmploymentShare ??
      0;

    // Build occupation lookup and aggregate Frey-Osborne risk by sector.
    const occupationLookup: Record<
      string,
      { title: string; sectorId: string }
    > = {};
    const bySector = new Map<
      string,
      { rawSum: number; calSum: number; n: number; titles: string[] }
    >();

    await Promise.all(
      allIsco.map(async (occ) => {
        occupationLookup[occ.code] = {
          title: occ.title,
          sectorId: occ.sectorId ?? '',
        };
        const risk = await this.signals.calibrateRisk(occ.code, cc);
        const sid = occ.sectorId ?? 'other';
        const cur = bySector.get(sid) ?? {
          rawSum: 0,
          calSum: 0,
          n: 0,
          titles: [],
        };
        cur.rawSum += risk.raw;
        cur.calSum += risk.calibrated;
        cur.n += 1;
        cur.titles.push(occ.title);
        bySector.set(sid, cur);
      }),
    );

    const sectorRisks: SectorRisk[] = Array.from(bySector.entries()).map(
      ([sectorId, v]) => ({
        sectorId,
        occupations: v.titles,
        rawAvg: v.rawSum / v.n,
        calibrated: v.calSum / v.n,
      }),
    );

    // Wittgenstein projections: prefer DB-derived shares (populated by the
    // harvester), fall back to the bundled seed when empty.
    const wittgensteinProjections: WittgensteinPoint[] | null =
      (await this.deriveWittgensteinFromDb(iso3)) ?? this.wittFromSeed(iso3);

    const youthWb = liveWb.YOUTH_UNEMPLOYMENT;
    const youthSnap =
      GROWTH_SNAP[cc]?.youthUnemploymentRate ??
      GROWTH_SNAP.GH?.youthUnemploymentRate ??
      0;

    return {
      countryCode: cc,
      countryName: country.name,
      currency: country.currency,
      currencySymbol: country.currencySymbol,
      context: country.context,
      youthUnemploymentRate: youthWb?.value ?? youthSnap,
      youthUnemploymentSource: youthWb ? 'live-worldbank' : 'snapshot',
      youthUnemploymentYear: youthWb?.year ?? 2023,
      gdpPerCapita: liveWb.GDP_PCAP?.value ?? null,
      gdpPerCapitaSource: liveWb.GDP_PCAP ? 'live-worldbank' : 'snapshot',
      internetUsersPct: liveWb.INTERNET_USERS?.value ?? null,
      informalEmploymentShare,
      minimumWage,
      growthBySector: snapshot.growthBySector,
      wagesByISCO: snapshot.wagesByIsco,
      occupationLookup,
      automationCalibration: {
        multiplier: snapshot.calibration.globalMultiplier,
        rationale: snapshot.calibration.rationale,
      },
      sectorRisks,
      wittgensteinProjections,
    };
  }

  /**
   * Try to build the (2025/2030/2035) education share triple from
   * `wittgenstein_projections` rows in Postgres. Returns null when the
   * harvester hasn't populated the table yet so the caller can fall back
   * to the bundled seed.
   */
  private async deriveWittgensteinFromDb(
    iso3: string,
  ): Promise<WittgensteinPoint[] | null> {
    try {
      const repo = this.signals.wittgensteinRepository();
      const rows = await repo.find({ where: { iso3 } });
      if (!rows.length) return null;
      const targetYears: Array<2025 | 2030 | 2035> = [2025, 2030, 2035];
      const out: WittgensteinPoint[] = [];
      for (const year of targetYears) {
        const yearRows = rows.filter((r) => r.year === year);
        if (!yearRows.length) return null;
        const totals = {
          noEdu: 0,
          primary: 0,
          lowerSec: 0,
          upperSec: 0,
          tertiary: 0,
        };
        let total = 0;
        for (const r of yearRows) {
          const pop = Number(r.population ?? 0);
          if (!Number.isFinite(pop) || pop <= 0) continue;
          total += pop;
          const lvl = (r.educLevel ?? '').toLowerCase();
          if (lvl.includes('no') || lvl.includes('none')) totals.noEdu += pop;
          else if (lvl.includes('primary') && !lvl.includes('post'))
            totals.primary += pop;
          else if (lvl.includes('lower') || lvl.includes('lowsec'))
            totals.lowerSec += pop;
          else if (lvl.includes('upper') || lvl.includes('upsec'))
            totals.upperSec += pop;
          else if (
            lvl.includes('tert') ||
            lvl.includes('post') ||
            lvl.includes('terti')
          )
            totals.tertiary += pop;
        }
        if (total <= 0) return null;
        out.push({
          year,
          shares: {
            noEdu: totals.noEdu / total,
            primary: totals.primary / total,
            lowerSec: totals.lowerSec / total,
            upperSec: totals.upperSec / total,
            tertiary: totals.tertiary / total,
          },
        });
      }
      return out.length === 3 ? out : null;
    } catch {
      return null;
    }
  }

  private wittFromSeed(iso3: string): WittgensteinPoint[] | null {
    const wittBlock = WITT_BY_COUNTRY[iso3];
    if (!wittBlock) return null;
    return (['2025', '2030', '2035'] as const).map((y) => ({
      year: Number(y) as 2025 | 2030 | 2035,
      shares: wittBlock[y] as unknown as WittgensteinShares,
    }));
  }
}
