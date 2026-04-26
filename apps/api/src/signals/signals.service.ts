import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WageEntity } from './entities/wage.entity';
import { SectorGrowthEntity } from './entities/sector-growth.entity';
import { FreyOsborneEntity } from './entities/frey-osborne.entity';
import { CountryCalibrationEntity } from './entities/country-calibration.entity';
import { WbIndicatorPointEntity } from './entities/wb-indicator.entity';
import { IlostatTimeSeriesEntity } from './entities/ilostat-time-series.entity';
import { WittgensteinProjectionEntity } from './entities/wittgenstein-projection.entity';
import { UnPopulationEntity } from './entities/un-population.entity';
import { UnescoUisEntity } from './entities/unesco-uis.entity';
import { IloFowTaskIndexEntity } from './entities/ilo-fow-task-index.entity';
import { ItuDigitalEntity } from './entities/itu-digital.entity';
import { OnetTaskEntity } from './entities/onet-task.entity';
import { CountryService } from '../country/country.service';
import { IscoService } from '../taxonomies/isco/isco.service';
import { CalibratedRisk, CountrySnapshot, RiskLevel } from './signals.types';
import type { CountryCode } from '../shared/types';

import freySeed from './data/frey-osborne.seed.json';
import ghWages from './data/ghana/wages.json';
import ghGrowth from './data/ghana/growth.json';
import ghCalibration from './data/ghana/calibration.json';
import bdWages from './data/bangladesh/wages.json';
import bdGrowth from './data/bangladesh/growth.json';
import bdCalibration from './data/bangladesh/calibration.json';
import keWages from './data/kenya/wages.json';
import keGrowth from './data/kenya/growth.json';
import keCalibration from './data/kenya/calibration.json';

const SNAPSHOT_INDEX: Record<
  string,
  {
    wages: {
      currency: string;
      wagesByISCO: Record<string, number>;
      vintage: string;
    };
    growth: { growthBySector: Record<string, number>; vintage: string };
    calibration: {
      globalMultiplier: number;
      sectorOverrides: Record<string, number>;
      rationale: string;
    };
  }
> = {
  GH: {
    wages: ghWages,
    growth: ghGrowth,
    calibration: ghCalibration,
  },
  BD: {
    wages: bdWages,
    growth: bdGrowth,
    calibration: bdCalibration,
  },
  KE: {
    wages: keWages,
    growth: keGrowth,
    calibration: keCalibration,
  },
};

/**
 * SignalsService is the unified Postgres-backed replacement for the
 * `lib/data.ts` + `lib/calibration.ts` pair on the web side. All numeric /
 * time-series signals (wages, growth, automation risk, calibration) live in
 * dedicated tables. Snapshots ship in /data/ as the first-boot seed.
 */
@Injectable()
export class SignalsService implements OnModuleInit {
  private readonly logger = new Logger(SignalsService.name);

  constructor(
    @InjectRepository(WageEntity)
    private readonly wageRepo: Repository<WageEntity>,
    @InjectRepository(SectorGrowthEntity)
    private readonly growthRepo: Repository<SectorGrowthEntity>,
    @InjectRepository(FreyOsborneEntity)
    private readonly freyRepo: Repository<FreyOsborneEntity>,
    @InjectRepository(CountryCalibrationEntity)
    private readonly calRepo: Repository<CountryCalibrationEntity>,
    @InjectRepository(WbIndicatorPointEntity)
    private readonly wbRepo: Repository<WbIndicatorPointEntity>,
    @InjectRepository(IlostatTimeSeriesEntity)
    private readonly ilostatRepo: Repository<IlostatTimeSeriesEntity>,
    @InjectRepository(WittgensteinProjectionEntity)
    private readonly wcdeRepo: Repository<WittgensteinProjectionEntity>,
    @InjectRepository(UnPopulationEntity)
    private readonly unPopRepo: Repository<UnPopulationEntity>,
    @InjectRepository(UnescoUisEntity)
    private readonly uisRepo: Repository<UnescoUisEntity>,
    @InjectRepository(IloFowTaskIndexEntity)
    private readonly iloFowRepo: Repository<IloFowTaskIndexEntity>,
    @InjectRepository(ItuDigitalEntity)
    private readonly ituRepo: Repository<ItuDigitalEntity>,
    @InjectRepository(OnetTaskEntity)
    private readonly onetRepo: Repository<OnetTaskEntity>,
    private readonly countries: CountryService,
    private readonly isco: IscoService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Seeding must NEVER crash the app: the dashboard / signals endpoints
    // already cope with empty tables, and a schema-not-yet-created or transient
    // Neon hiccup at boot should not take down the whole API.
    try {
      await this.seedFreyOsborne();
    } catch (err) {
      this.logger.warn(
        `Frey-Osborne seed skipped: ${(err as Error).message}. ` +
          `Run with TYPEORM_SYNC=true (dev) or apply migrations (prod).`,
      );
    }
    try {
      await this.seedCountrySnapshots();
    } catch (err) {
      this.logger.warn(
        `Country snapshot seed skipped: ${(err as Error).message}.`,
      );
    }
  }

  // ---------- Seeding ----------

  private async seedFreyOsborne(): Promise<void> {
    if ((await this.freyRepo.count()) > 0) return;
    const scores = (freySeed as { scores: Record<string, number> }).scores;
    const rows = Object.entries(scores).map(([iscoCode, probability]) =>
      this.freyRepo.create({
        iscoCode,
        probability: probability.toFixed(3),
        source: 'snapshot',
        updatedAt: new Date(),
      }),
    );
    await this.freyRepo.save(rows);
    this.logger.log(`Seeded ${rows.length} Frey-Osborne scores.`);
  }

  private async seedCountrySnapshots(): Promise<void> {
    // Seed if EITHER calibration OR wages are missing — a previous boot may
    // have seeded calibration but crashed before writing wages.
    const [calCount, wageCount] = await Promise.all([
      this.calRepo.count(),
      this.wageRepo.count(),
    ]);
    if (calCount > 0 && wageCount > 0) return;
    for (const [code, snap] of Object.entries(SNAPSHOT_INDEX)) {
      await this.calRepo.save(
        this.calRepo.create({
          countryCode: code,
          globalMultiplier: snap.calibration.globalMultiplier.toFixed(3),
          sectorOverrides: snap.calibration.sectorOverrides ?? {},
          rationale: snap.calibration.rationale ?? null,
          source: 'snapshot',
          updatedAt: new Date(),
        }),
      );
      const wageRows = Object.entries(snap.wages.wagesByISCO).map(
        ([iscoCode, amount]) =>
          this.wageRepo.create({
            countryCode: code,
            iscoCode,
            amount: Number(amount).toFixed(2),
            currency: snap.wages.currency,
            vintage: snap.wages.vintage,
            source: 'snapshot',
            updatedAt: new Date(),
          }),
      );
      await this.wageRepo.save(wageRows);
      const growthRows = Object.entries(snap.growth.growthBySector).map(
        ([sectorId, yoyPercent]) =>
          this.growthRepo.create({
            countryCode: code,
            sectorId,
            yoyPercent: Number(yoyPercent).toFixed(3),
            vintage: snap.growth.vintage,
            source: 'snapshot',
            updatedAt: new Date(),
          }),
      );
      await this.growthRepo.save(growthRows);
    }
    this.logger.log(
      `Seeded calibration + wages + growth for ${Object.keys(SNAPSHOT_INDEX).length} snapshot countries.`,
    );
  }

  // ---------- Reads ----------

  async getCalibrationFor(
    countryCode: CountryCode,
  ): Promise<CountryCalibrationEntity | null> {
    const cc = countryCode.toUpperCase();
    const direct = await this.calRepo.findOne({ where: { countryCode: cc } });
    if (direct) return direct;
    const fallback = this.synthesiseCalibration(cc);
    return fallback;
  }

  /** When a country has no curated row, synthesise one from the registry. */
  private synthesiseCalibration(
    countryCode: CountryCode,
  ): CountryCalibrationEntity {
    const country = this.countries.getOrDefault(countryCode);
    const ent = this.calRepo.create({
      countryCode: country.code,
      globalMultiplier: country.automationCalibration.toFixed(3),
      sectorOverrides: SNAPSHOT_INDEX.GH.calibration.sectorOverrides,
      rationale: `Synthesised from registry: automationCalibration ${country.automationCalibration} (${country.context}).`,
      source: 'synthesised',
      updatedAt: new Date(),
    });
    return ent;
  }

  async getWageFor(
    countryCode: CountryCode,
    iscoCode: string,
  ): Promise<number> {
    const row = await this.wageRepo.findOne({
      where: { countryCode: countryCode.toUpperCase(), iscoCode },
    });
    if (row) return Number(row.amount);
    // Synthesise from Ghana baseline x calibration if no curated row
    const ghRow = await this.wageRepo.findOne({
      where: { countryCode: 'GH', iscoCode },
    });
    if (!ghRow) return 0;
    const country = this.countries.getOrDefault(countryCode);
    return Math.round(
      Number(ghRow.amount) * (1 + country.automationCalibration * 1.5),
    );
  }

  getCurrencyFor(countryCode: CountryCode): string {
    return this.countries.getOrDefault(countryCode).currency;
  }

  async getGrowthFor(
    countryCode: CountryCode,
    sectorId: string,
  ): Promise<number> {
    const cc = countryCode.toUpperCase();
    const row = await this.growthRepo.findOne({
      where: { countryCode: cc, sectorId },
    });
    if (row) return Number(row.yoyPercent);
    const fallback = await this.growthRepo.findOne({
      where: { countryCode: 'GH', sectorId },
    });
    return fallback ? Number(fallback.yoyPercent) : 0;
  }

  async getFreyOsborneRaw(iscoCode: string): Promise<number> {
    const row = await this.freyRepo.findOne({ where: { iscoCode } });
    return row ? Number(row.probability) : 0.5;
  }

  freyOsborneCount(): Promise<number> {
    return this.freyRepo.count();
  }

  /** Country snapshot — wages, growth, calibration — fully hydrated from DB. */
  async getCountrySnapshot(countryCode: CountryCode): Promise<CountrySnapshot> {
    const cc = countryCode.toUpperCase();
    const country = this.countries.getOrDefault(cc);
    const [wageRows, growthRows, calRow] = await Promise.all([
      this.wageRepo.find({ where: { countryCode: cc } }),
      this.growthRepo.find({ where: { countryCode: cc } }),
      this.calRepo.findOne({ where: { countryCode: cc } }),
    ]);
    const calibration = calRow ?? this.synthesiseCalibration(cc);
    return {
      countryCode: cc,
      currency: country.currency,
      wagesByIsco: Object.fromEntries(
        wageRows.map((r) => [r.iscoCode, Number(r.amount)]),
      ),
      growthBySector: Object.fromEntries(
        growthRows.map((r) => [r.sectorId, Number(r.yoyPercent)]),
      ),
      calibration: {
        globalMultiplier: Number(calibration.globalMultiplier),
        sectorOverrides: calibration.sectorOverrides ?? {},
        rationale: calibration.rationale ?? '',
      },
    };
  }

  // ---------- Calibration logic (port of lib/calibration.ts) ----------

  async calibrateRisk(
    iscoCode: string,
    countryCode: CountryCode,
  ): Promise<CalibratedRisk> {
    const raw = await this.getFreyOsborneRaw(iscoCode);
    const occupation = await this.isco.findByCode(iscoCode);
    const cal = await this.getCalibrationFor(countryCode);
    const sectorOverride =
      occupation?.sectorId && cal?.sectorOverrides
        ? cal.sectorOverrides[occupation.sectorId]
        : undefined;
    const multiplier =
      sectorOverride ?? (cal ? Number(cal.globalMultiplier) : 1);
    const calibrated = Math.min(1, Math.max(0, raw * multiplier));
    return {
      iscoCode,
      raw,
      calibrated,
      multiplier,
      rationale: cal?.rationale ?? '',
    };
  }

  riskLevel(score: number): RiskLevel {
    if (score < 0.35) return 'low';
    if (score < 0.65) return 'medium';
    return 'high';
  }

  // ---------- WB indicator writes (used by harvester) ----------

  async upsertWbIndicatorPoints(
    rows: Array<{
      iso3: string;
      indicator: string;
      year: number;
      value: number;
      source?: string;
    }>,
    runId?: string | null,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const entities = rows.map((r) =>
      this.wbRepo.create({
        iso3: r.iso3,
        indicator: r.indicator,
        year: r.year,
        value: r.value.toFixed(6),
        source: r.source ?? 'wb',
        runId: runId ?? null,
        updatedAt: new Date(),
      }),
    );
    await this.wbRepo.upsert(entities, {
      conflictPaths: ['iso3', 'indicator', 'year'],
    });
    return entities.length;
  }

  // ---------- Frey/wage/growth bulk upserts (used by harvesters) ----------

  async upsertFreyOsborne(
    rows: Array<{ iscoCode: string; probability: number; source?: string }>,
    runId?: string | null,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const entities = rows.map((r) =>
      this.freyRepo.create({
        iscoCode: r.iscoCode,
        probability: r.probability.toFixed(3),
        source: r.source ?? 'snapshot',
        runId: runId ?? null,
        updatedAt: new Date(),
      }),
    );
    await this.freyRepo.upsert(entities, { conflictPaths: ['iscoCode'] });
    return entities.length;
  }

  async upsertWages(
    rows: Array<{
      countryCode: string;
      iscoCode: string;
      amount: number;
      currency: string;
      vintage?: string;
      source?: string;
    }>,
    runId?: string | null,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const entities = rows.map((r) =>
      this.wageRepo.create({
        countryCode: r.countryCode,
        iscoCode: r.iscoCode,
        amount: r.amount.toFixed(2),
        currency: r.currency,
        vintage: r.vintage ?? null,
        source: r.source ?? 'snapshot',
        runId: runId ?? null,
        updatedAt: new Date(),
      }),
    );
    await this.wageRepo.upsert(entities, {
      conflictPaths: ['countryCode', 'iscoCode'],
    });
    return entities.length;
  }

  async upsertSectorGrowth(
    rows: Array<{
      countryCode: string;
      sectorId: string;
      yoyPercent: number;
      vintage?: string;
      source?: string;
    }>,
    runId?: string | null,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const entities = rows.map((r) =>
      this.growthRepo.create({
        countryCode: r.countryCode,
        sectorId: r.sectorId,
        yoyPercent: r.yoyPercent.toFixed(3),
        vintage: r.vintage ?? null,
        source: r.source ?? 'snapshot',
        runId: runId ?? null,
        updatedAt: new Date(),
      }),
    );
    await this.growthRepo.upsert(entities, {
      conflictPaths: ['countryCode', 'sectorId'],
    });
    return entities.length;
  }

  // ---------- ILOSTAT bulk upsert ----------

  async upsertIlostatPoints(
    rows: Array<{
      refArea: string;
      indicatorId: string;
      indicatorName?: string | null;
      sex?: string;
      classif1?: string;
      time: string;
      year?: number | null;
      value: number | null;
      obsStatus?: string | null;
    }>,
    runId?: string | null,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const entities = rows.map((r) =>
      this.ilostatRepo.create({
        refArea: r.refArea,
        indicatorId: r.indicatorId,
        indicatorName: r.indicatorName ?? null,
        sex: r.sex ?? '',
        classif1: r.classif1 ?? '',
        time: r.time,
        year: r.year ?? this.parseIlostatYear(r.time),
        value: r.value === null || r.value === undefined ? null : r.value.toFixed(6),
        obsStatus: r.obsStatus ?? null,
        runId: runId ?? null,
        updatedAt: new Date(),
      }),
    );
    await this.ilostatRepo.upsert(entities, {
      conflictPaths: ['refArea', 'indicatorId', 'sex', 'classif1', 'time'],
    });
    return entities.length;
  }

  private parseIlostatYear(time: string): number | null {
    if (!time) return null;
    const m = String(time).match(/^(\d{4})/);
    return m ? Number(m[1]) : null;
  }

  // ---------- Wittgenstein bulk upsert ----------

  async upsertWittgenstein(
    rows: Array<{
      iso3: string;
      year: number;
      scenario?: string;
      educLevel?: string;
      sex?: string;
      ageGroup?: string;
      population: number | null;
    }>,
    runId?: string | null,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const entities = rows.map((r) =>
      this.wcdeRepo.create({
        iso3: r.iso3,
        year: r.year,
        scenario: r.scenario ?? '',
        educLevel: r.educLevel ?? '',
        sex: r.sex ?? '',
        ageGroup: r.ageGroup ?? '',
        population:
          r.population === null || r.population === undefined
            ? null
            : r.population.toFixed(4),
        runId: runId ?? null,
        updatedAt: new Date(),
      }),
    );
    await this.wcdeRepo.upsert(entities, {
      conflictPaths: ['iso3', 'year', 'scenario', 'educLevel', 'sex', 'ageGroup'],
    });
    return entities.length;
  }

  // ---------- UN Population bulk upsert ----------

  async upsertUnPopulation(
    rows: Array<{
      iso3: string;
      indicator: string;
      indicatorName?: string | null;
      sex?: string;
      ageGroup?: string;
      year: number;
      value: number | null;
    }>,
    runId?: string | null,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const entities = rows.map((r) =>
      this.unPopRepo.create({
        iso3: r.iso3,
        indicator: r.indicator,
        indicatorName: r.indicatorName ?? null,
        sex: r.sex ?? '',
        ageGroup: r.ageGroup ?? '',
        year: r.year,
        value:
          r.value === null || r.value === undefined ? null : r.value.toFixed(4),
        runId: runId ?? null,
        updatedAt: new Date(),
      }),
    );
    await this.unPopRepo.upsert(entities, {
      conflictPaths: ['iso3', 'indicator', 'sex', 'ageGroup', 'year'],
    });
    return entities.length;
  }

  // ---------- UNESCO UIS bulk upsert ----------

  async upsertUnescoUis(
    rows: Array<{
      iso3: string;
      indicator: string;
      indicatorName?: string | null;
      year: number;
      value: number | null;
    }>,
    runId?: string | null,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const entities = rows.map((r) =>
      this.uisRepo.create({
        iso3: r.iso3,
        indicator: r.indicator,
        indicatorName: r.indicatorName ?? null,
        year: r.year,
        value:
          r.value === null || r.value === undefined ? null : r.value.toFixed(6),
        runId: runId ?? null,
        updatedAt: new Date(),
      }),
    );
    await this.uisRepo.upsert(entities, {
      conflictPaths: ['iso3', 'indicator', 'year'],
    });
    return entities.length;
  }

  // ---------- ILO FoW task indices bulk upsert ----------

  async upsertIloFow(
    rows: Array<{
      iscoCode: string;
      metric: string;
      year?: number | null;
      value: number | null;
      note?: string | null;
    }>,
    runId?: string | null,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const entities = rows.map((r) =>
      this.iloFowRepo.create({
        iscoCode: r.iscoCode,
        metric: r.metric,
        year: r.year ?? null,
        value:
          r.value === null || r.value === undefined ? null : r.value.toFixed(4),
        note: r.note ?? null,
        runId: runId ?? null,
        updatedAt: new Date(),
      }),
    );
    await this.iloFowRepo.upsert(entities, {
      conflictPaths: ['iscoCode', 'metric', 'year'],
    });
    return entities.length;
  }

  // ---------- ITU digital bulk upsert ----------

  async upsertItuDigital(
    rows: Array<{
      iso3: string;
      indicator: string;
      indicatorName?: string | null;
      year: number;
      value: number | null;
    }>,
    runId?: string | null,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const entities = rows.map((r) =>
      this.ituRepo.create({
        iso3: r.iso3,
        indicator: r.indicator,
        indicatorName: r.indicatorName ?? null,
        year: r.year,
        value:
          r.value === null || r.value === undefined ? null : r.value.toFixed(4),
        runId: runId ?? null,
        updatedAt: new Date(),
      }),
    );
    await this.ituRepo.upsert(entities, {
      conflictPaths: ['iso3', 'indicator', 'year'],
    });
    return entities.length;
  }

  // ---------- O*NET tasks bulk upsert ----------

  async upsertOnetTasks(
    rows: Array<{
      onetCode: string;
      taskId: string;
      statement: string;
      importance?: number | null;
      level?: number | null;
      taskType?: string;
      iscoCode?: string | null;
    }>,
    runId?: string | null,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const entities = rows.map((r) =>
      this.onetRepo.create({
        onetCode: r.onetCode,
        taskId: r.taskId,
        statement: r.statement,
        importance:
          r.importance === null || r.importance === undefined
            ? null
            : r.importance.toFixed(2),
        level:
          r.level === null || r.level === undefined ? null : r.level.toFixed(2),
        taskType: r.taskType ?? '',
        iscoCode: r.iscoCode ?? null,
        runId: runId ?? null,
        updatedAt: new Date(),
      }),
    );
    await this.onetRepo.upsert(entities, {
      conflictPaths: ['onetCode', 'taskId'],
    });
    return entities.length;
  }

  // ---------- Read helpers used by signal computers ----------

  ilostatRepository(): Repository<IlostatTimeSeriesEntity> {
    return this.ilostatRepo;
  }
  wittgensteinRepository(): Repository<WittgensteinProjectionEntity> {
    return this.wcdeRepo;
  }
  unPopulationRepository(): Repository<UnPopulationEntity> {
    return this.unPopRepo;
  }
  unescoUisRepository(): Repository<UnescoUisEntity> {
    return this.uisRepo;
  }
  iloFowRepository(): Repository<IloFowTaskIndexEntity> {
    return this.iloFowRepo;
  }
  ituDigitalRepository(): Repository<ItuDigitalEntity> {
    return this.ituRepo;
  }
  onetRepository(): Repository<OnetTaskEntity> {
    return this.onetRepo;
  }
  wbRepository(): Repository<WbIndicatorPointEntity> {
    return this.wbRepo;
  }
  wageRepository(): Repository<WageEntity> {
    return this.wageRepo;
  }
  growthRepository(): Repository<SectorGrowthEntity> {
    return this.growthRepo;
  }
  freyRepository(): Repository<FreyOsborneEntity> {
    return this.freyRepo;
  }
}
