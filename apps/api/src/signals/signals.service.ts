import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WageEntity } from './entities/wage.entity';
import { SectorGrowthEntity } from './entities/sector-growth.entity';
import { FreyOsborneEntity } from './entities/frey-osborne.entity';
import { CountryCalibrationEntity } from './entities/country-calibration.entity';
import { WbIndicatorPointEntity } from './entities/wb-indicator.entity';
import { CountryService } from '../country/country.service';
import { IscoService } from '../taxonomies/isco/isco.service';
import {
  CalibratedRisk,
  CountrySnapshot,
  RiskLevel,
} from './signals.types';
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
    wages: { currency: string; wagesByISCO: Record<string, number>; vintage: string };
    growth: { growthBySector: Record<string, number>; vintage: string };
    calibration: {
      globalMultiplier: number;
      sectorOverrides: Record<string, number>;
      rationale: string;
    };
  }
> = {
  GH: {
    wages: ghWages as any,
    growth: ghGrowth as any,
    calibration: ghCalibration as any,
  },
  BD: {
    wages: bdWages as any,
    growth: bdGrowth as any,
    calibration: bdCalibration as any,
  },
  KE: {
    wages: keWages as any,
    growth: keGrowth as any,
    calibration: keCalibration as any,
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
    private readonly countries: CountryService,
    private readonly isco: IscoService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedFreyOsborne();
    await this.seedCountrySnapshots();
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
    if ((await this.calRepo.count()) > 0) return;
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

  async getCurrencyFor(countryCode: CountryCode): Promise<string> {
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
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const entities = rows.map((r) =>
      this.wbRepo.create({
        iso3: r.iso3,
        indicator: r.indicator,
        year: r.year,
        value: r.value.toFixed(6),
        source: r.source ?? 'wb',
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
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const entities = rows.map((r) =>
      this.freyRepo.create({
        iscoCode: r.iscoCode,
        probability: r.probability.toFixed(3),
        source: r.source ?? 'snapshot',
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
        updatedAt: new Date(),
      }),
    );
    await this.wageRepo.upsert(entities, {
      conflictPaths: ['countryCode', 'iscoCode'],
    });
    return entities.length;
  }
}
