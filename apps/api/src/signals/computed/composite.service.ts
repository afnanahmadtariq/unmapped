import { Injectable, Logger } from '@nestjs/common';
import { SignalsService } from '../signals.service';
import { CountryService } from '../../country/country.service';
import { IscoService } from '../../taxonomies/isco/isco.service';
import { JobsService } from '../../jobs/jobs.service';
import type {
  CompositeSignals,
  IncomeSignals,
  DemandSignals,
  AutomationSignals,
  SkillsDemandSignals,
  RegionalSignals,
  EducationSignals,
  InequalitySignals,
  StabilitySignals,
} from './composite.types';

const ILOSTAT_WAGE = 'EAR_INEE_SEX_ECO_NB';
const ILOSTAT_INFORMAL = 'IFL_XEES_SEX_RT';
const ILOSTAT_EMP = 'EMP_TEMP_SEX_AGE_NB';

const ILO_FOW_ROUTINE_METRIC = 'SDG_C821_SEX_RT';
const ILO_FOW_AI_METRIC = 'IFL_XEES_SEX_RT';

const UIS_EDU_SPEND = 'SE.XPD.TOTL.GD.ZS';
const UIS_TERTIARY_ENROLL = 'SE.TER.ENRR';

const ITU_INTERNET = 'IT.NET.USER.ZS';
const ITU_BROADBAND = 'IT.NET.BBND.P2';

const RECENT_YEARS_WINDOW = 5;

/**
 * Computes the full A-H composite signal bundle for `(countryCode, iscoCode?)`.
 * Each computer is intentionally tolerant of missing data: if a row is not
 * available it returns `null` instead of throwing, so the dashboard can
 * still render with partial coverage on a cold-boot DB.
 */
@Injectable()
export class CompositeSignalService {
  private readonly logger = new Logger(CompositeSignalService.name);

  constructor(
    private readonly signals: SignalsService,
    private readonly countries: CountryService,
    private readonly isco: IscoService,
    private readonly jobs: JobsService,
  ) {}

  async compute(
    countryCode: string,
    iscoCode?: string | null,
    declaredSkills: string[] = [],
  ): Promise<CompositeSignals> {
    const cc = countryCode.toUpperCase();
    const country = this.countries.getOrDefault(cc);

    const [
      income,
      automation,
      regional,
      education,
      inequality,
      stability,
    ] = await Promise.all([
      this.computeIncome(country.iso3, iscoCode ?? null),
      this.computeAutomation(cc, iscoCode ?? null, declaredSkills),
      this.computeRegional(country.iso3),
      this.computeEducation(country.iso3),
      this.computeInequality(country.iso3),
      this.computeStability(cc, iscoCode ?? null),
    ]);

    // Demand and skills-demand depend on jobs / iscoCode → run after we have
    // the occupation title.
    const occupation = iscoCode
      ? await this.isco.findByCode(iscoCode)
      : null;
    const demand = await this.computeDemand(
      cc,
      occupation?.sectorId ?? null,
      occupation?.title ?? null,
    );
    const skillsDemand = await this.computeSkillsDemand(declaredSkills);

    return {
      countryCode: cc,
      iscoCode: iscoCode ?? null,
      generatedAt: new Date().toISOString(),
      income,
      demand,
      automation,
      skillsDemand,
      regional,
      education,
      inequality,
      stability,
    };
  }

  // ---------- A. Income ----------

  private async computeIncome(
    iso3: string,
    iscoCode: string | null,
  ): Promise<IncomeSignals> {
    try {
      const repo = this.signals.ilostatRepository();
      const wagePoints = await repo.find({
        where: {
          refArea: iso3,
          indicatorId: ILOSTAT_WAGE,
        },
      });
      const informalPoints = await repo.find({
        where: {
          refArea: iso3,
          indicatorId: ILOSTAT_INFORMAL,
        },
      });
      const numericValues = wagePoints
        .map((p) => Number(p.value))
        .filter((v) => Number.isFinite(v))
        .sort((a, b) => a - b);
      const wageFloor = numericValues.length
        ? numericValues[Math.floor(numericValues.length * 0.1)]
        : null;
      const yoy = this.yearOverYear(
        wagePoints
          .filter((p) => p.year !== null)
          .map((p) => ({ year: p.year as number, value: Number(p.value) })),
      );
      const last5 = wagePoints
        .filter((p) => p.year !== null)
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
        .slice(0, RECENT_YEARS_WINDOW)
        .map((p) => Number(p.value))
        .filter((v) => Number.isFinite(v));
      const incomeVolatility =
        last5.length >= 2 ? this.stddev(last5) : null;
      const informalShare = informalPoints.length
        ? this.latestValue(
            informalPoints
              .filter((p) => p.year !== null)
              .map((p) => ({
                year: p.year as number,
                value: Number(p.value),
              })),
          )
        : null;
      const informalFormalGap =
        informalShare !== null && informalShare > 0
          ? Math.max(0.5, 1 - informalShare / 100)
          : null;
      // Note: iscoCode currently only narrows the time series when
      // `classif1` carries an ISCO breakdown — the harvester emits raw
      // refArea/indicator/time today; a future Phase 4.1 can extend the
      // entity with classif1=ISCO joins.
      void iscoCode;
      return { wageFloor, wageGrowthYoY: yoy, incomeVolatility, informalFormalGap };
    } catch (err) {
      this.logger.warn(`income signal failed: ${(err as Error).message}`);
      return {
        wageFloor: null,
        wageGrowthYoY: null,
        incomeVolatility: null,
        informalFormalGap: null,
      };
    }
  }

  // ---------- B. Demand ----------

  private async computeDemand(
    countryCode: string,
    sectorId: string | null,
    title: string | null,
  ): Promise<DemandSignals> {
    let sectorEmploymentGrowth: number | null = null;
    if (sectorId) {
      try {
        sectorEmploymentGrowth = await this.signals.getGrowthFor(
          countryCode,
          sectorId,
        );
      } catch {
        sectorEmploymentGrowth = null;
      }
    }
    let vacancyRate: number | null = null;
    if (title) {
      try {
        const hits = await this.jobs.search(title, countryCode);
        vacancyRate = hits.length;
      } catch {
        vacancyRate = null;
      }
    }
    // demand-supply gap: vacancyRate − graduateRate (graduateRate proxied by
    // tertiary enrollment % when available). Returns null when either side
    // is unknown.
    let demandSupplyGap: number | null = null;
    if (vacancyRate !== null) {
      try {
        const repo = this.signals.unescoUisRepository();
        const country = this.countries.getOrDefault(countryCode);
        const tert = await repo.findOne({
          where: { iso3: country.iso3, indicator: UIS_TERTIARY_ENROLL },
          order: { year: 'DESC' },
        });
        if (tert?.value !== null && tert?.value !== undefined) {
          demandSupplyGap = vacancyRate - Number(tert.value);
        }
      } catch {
        demandSupplyGap = null;
      }
    }
    return { sectorEmploymentGrowth, vacancyRate, demandSupplyGap };
  }

  // ---------- C. Automation ----------

  private async computeAutomation(
    countryCode: string,
    iscoCode: string | null,
    declaredSkills: string[],
  ): Promise<AutomationSignals> {
    let automationRisk: number | null = null;
    let automationRiskRaw: number | null = null;
    if (iscoCode) {
      try {
        const cal = await this.signals.calibrateRisk(iscoCode, countryCode);
        automationRisk = cal.calibrated;
        automationRiskRaw = cal.raw;
      } catch {
        automationRisk = null;
      }
    }

    let routineRatio: number | null = null;
    let aiExposureIndex: number | null = null;
    try {
      const repo = this.signals.iloFowRepository();
      if (iscoCode) {
        const routine = await repo.findOne({
          where: { iscoCode, metric: ILO_FOW_ROUTINE_METRIC },
          order: { year: 'DESC' },
        });
        if (routine?.value !== null && routine?.value !== undefined) {
          routineRatio = Number(routine.value);
        }
        const ai = await repo.findOne({
          where: { iscoCode, metric: ILO_FOW_AI_METRIC },
          order: { year: 'DESC' },
        });
        if (ai?.value !== null && ai?.value !== undefined) {
          aiExposureIndex = Number(ai.value);
        }
      }
    } catch {
      routineRatio = null;
    }

    let skillDurability: number | null = null;
    if (iscoCode) {
      // 1 − weighted avg risk on declared ISCO codes (or just the focal one)
      try {
        const codes = declaredSkills.length ? declaredSkills : [iscoCode];
        const risks = await Promise.all(
          codes.map((c) => this.signals.calibrateRisk(c, countryCode)),
        );
        const avg =
          risks.reduce((sum, r) => sum + r.calibrated, 0) / risks.length;
        skillDurability = 1 - avg;
      } catch {
        skillDurability = null;
      }
    }

    return {
      automationRisk,
      automationRiskRaw,
      routineRatio,
      aiExposureIndex,
      skillDurability,
    };
  }

  // ---------- D. Skills demand ----------

  private async computeSkillsDemand(
    declaredSkills: string[],
  ): Promise<SkillsDemandSignals> {
    // For now we surface the structure with empty arrays / nulls. Cross-skill
    // transferability is computed off the ESCO graph, which can be built
    // from `iscoLinks` length on the EscoSkillEntity in a follow-up patch.
    return {
      topDemandedSkills: [],
      emergingSkills: [],
      skillScarcityIndex: null,
      crossSkillTransferability:
        declaredSkills.length > 0 ? declaredSkills.length / 10 : null,
    };
  }

  // ---------- E. Regional / digital ----------

  private async computeRegional(iso3: string): Promise<RegionalSignals> {
    let internetRate: number | null = null;
    let broadbandRate: number | null = null;
    try {
      const repo = this.signals.ituDigitalRepository();
      const internet = await repo.findOne({
        where: { iso3, indicator: ITU_INTERNET },
        order: { year: 'DESC' },
      });
      if (internet?.value !== null && internet?.value !== undefined) {
        internetRate = Number(internet.value);
      }
      const broadband = await repo.findOne({
        where: { iso3, indicator: ITU_BROADBAND },
        order: { year: 'DESC' },
      });
      if (broadband?.value !== null && broadband?.value !== undefined) {
        broadbandRate = Number(broadband.value);
      }
    } catch {
      // leave as null
    }
    // urban-rural gap: WB doesn't expose a single split, so we approximate
    // with broadband adoption shortfall vs internet usage rate. When both
    // values are known, gap ≈ internetRate - broadbandRate (a rough proxy).
    const urbanRuralGap =
      internetRate !== null && broadbandRate !== null
        ? Math.max(0, internetRate - broadbandRate)
        : null;
    return { urbanRuralGap, broadbandRate, internetRate };
  }

  // ---------- F. Education / workforce ----------

  private async computeEducation(iso3: string): Promise<EducationSignals> {
    let upperSecondaryShare2030: number | null = null;
    let tertiaryShare2030: number | null = null;
    let educationSpendShareGdp: number | null = null;
    try {
      const repo = this.signals.wittgensteinRepository();
      const rows = await repo.find({ where: { iso3, year: 2030 } });
      if (rows.length > 0) {
        let total = 0;
        let upper = 0;
        let tertiary = 0;
        for (const r of rows) {
          const pop = Number(r.population ?? 0);
          if (!Number.isFinite(pop) || pop <= 0) continue;
          total += pop;
          const lvl = (r.educLevel ?? '').toLowerCase();
          if (lvl.includes('upper') || lvl.includes('upsec') || lvl.includes('post'))
            upper += pop;
          if (lvl.includes('tert') || lvl.includes('post')) tertiary += pop;
        }
        if (total > 0) {
          upperSecondaryShare2030 = upper / total;
          tertiaryShare2030 = tertiary / total;
        }
      }
    } catch {
      // leave nulls
    }
    try {
      const repo = this.signals.unescoUisRepository();
      const point = await repo.findOne({
        where: { iso3, indicator: UIS_EDU_SPEND },
        order: { year: 'DESC' },
      });
      if (point?.value !== null && point?.value !== undefined) {
        educationSpendShareGdp = Number(point.value);
      }
    } catch {
      // leave null
    }
    return {
      upperSecondaryShare2030,
      tertiaryShare2030,
      educationSpendShareGdp,
    };
  }

  // ---------- G. Inequality ----------

  private async computeInequality(iso3: string): Promise<InequalitySignals> {
    let genderEmploymentGap: number | null = null;
    let informalShare: number | null = null;
    try {
      const repo = this.signals.ilostatRepository();
      const empMale = await repo.find({
        where: { refArea: iso3, indicatorId: ILOSTAT_EMP, sex: 'SEX_M' },
      });
      const empFemale = await repo.find({
        where: { refArea: iso3, indicatorId: ILOSTAT_EMP, sex: 'SEX_F' },
      });
      const latestM = this.latestValueFromTimeSeries(empMale);
      const latestF = this.latestValueFromTimeSeries(empFemale);
      if (latestM !== null && latestF !== null) {
        genderEmploymentGap = latestF - latestM;
      }
      const informal = await repo.find({
        where: { refArea: iso3, indicatorId: ILOSTAT_INFORMAL },
      });
      const latest = this.latestValueFromTimeSeries(informal);
      if (latest !== null) informalShare = latest / 100;
    } catch {
      // leave nulls
    }
    return { genderEmploymentGap, informalShare };
  }

  // ---------- H. Stability ----------

  private async computeStability(
    countryCode: string,
    iscoCode: string | null,
  ): Promise<StabilitySignals> {
    let sectorVolatilityIndex: number | null = null;
    try {
      const repo = this.signals.growthRepository();
      const rows = await repo.find({ where: { countryCode } });
      if (rows.length >= 2) {
        sectorVolatilityIndex = this.stddev(rows.map((r) => Number(r.yoyPercent)));
      }
    } catch {
      // leave null
    }
    // Heuristic: agriculture sectors are seasonal. We flag based on iscoCode
    // major group 6 (skilled agricultural workers) when present.
    const seasonalityFlag = iscoCode
      ? iscoCode.startsWith('6') || iscoCode.startsWith('92')
      : false;
    return { sectorVolatilityIndex, seasonalityFlag };
  }

  // ---------- helpers ----------

  private stddev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) /
      (values.length - 1);
    return Math.sqrt(variance);
  }

  private yearOverYear(
    points: Array<{ year: number; value: number }>,
  ): number | null {
    const sorted = points
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => b.year - a.year);
    if (sorted.length < 2) return null;
    const [latest, prev] = sorted;
    if (!prev.value) return null;
    return ((latest.value - prev.value) / Math.abs(prev.value)) * 100;
  }

  private latestValue(
    points: Array<{ year: number; value: number }>,
  ): number | null {
    const sorted = points
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => b.year - a.year);
    return sorted.length ? sorted[0].value : null;
  }

  private latestValueFromTimeSeries(
    rows: Array<{ year: number | null; value: string | null }>,
  ): number | null {
    const points = rows
      .filter((r): r is { year: number; value: string } =>
        r.year !== null && r.value !== null && r.value !== undefined,
      )
      .map((r) => ({ year: r.year, value: Number(r.value) }));
    return this.latestValue(points);
  }
}
