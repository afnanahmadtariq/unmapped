import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import iscoSeed from './data/isco-occupations.seed.json';
import { IscoOccupationEntity } from './isco.entity';

interface SeedRow {
  code: string;
  title: string;
  skillLevel?: number;
  sectorId?: string;
}

@Injectable()
export class IscoService implements OnModuleInit {
  private readonly logger = new Logger(IscoService.name);

  constructor(
    @InjectRepository(IscoOccupationEntity)
    private readonly repo: Repository<IscoOccupationEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.repo.count();
    if (count > 0) {
      this.logger.log(`ISCO table populated (${count} rows). Skipping seed.`);
      return;
    }
    const rows = (iscoSeed as { occupations: SeedRow[] }).occupations.map((r) =>
      this.repo.create({
        code: r.code,
        title: r.title,
        skillLevel: r.skillLevel ?? null,
        sectorId: r.sectorId ?? null,
        source: 'snapshot',
        updatedAt: new Date(),
      }),
    );
    await this.repo.save(rows);
    this.logger.log(`Seeded ${rows.length} ISCO-08 occupations.`);
  }

  findByCode(code: string): Promise<IscoOccupationEntity | null> {
    return this.repo.findOne({ where: { code } });
  }

  findManyByCodes(codes: string[]): Promise<IscoOccupationEntity[]> {
    if (codes.length === 0) return Promise.resolve([]);
    return this.repo.find({ where: { code: In(codes) } });
  }

  findAll(): Promise<IscoOccupationEntity[]> {
    return this.repo.find({ order: { code: 'ASC' } });
  }

  /** Bulk upsert used by the ILO ISCO harvester. */
  async upsertMany(
    rows: Array<{
      code: string;
      title: string;
      skillLevel?: number | null;
      sectorId?: string | null;
      source?: string;
    }>,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const entities = rows.map((r) =>
      this.repo.create({
        code: r.code,
        title: r.title,
        skillLevel: r.skillLevel ?? null,
        sectorId: r.sectorId ?? null,
        source: r.source ?? 'esco-live',
        updatedAt: new Date(),
      }),
    );
    await this.repo.upsert(entities, { conflictPaths: ['code'] });
    return entities.length;
  }
}
