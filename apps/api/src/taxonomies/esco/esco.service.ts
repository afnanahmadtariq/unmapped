import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EscoSkillEntity } from './esco.entity';

/**
 * Pure Postgres-side reads / writes for ESCO. No vector concerns here —
 * those live in EscoIngestService (write side) and EscoSearchService (read side).
 */
@Injectable()
export class EscoService {
  constructor(
    @InjectRepository(EscoSkillEntity)
    private readonly repo: Repository<EscoSkillEntity>,
  ) {}

  findByCode(code: string): Promise<EscoSkillEntity | null> {
    return this.repo.findOne({ where: { code } });
  }

  findManyByCodes(codes: string[]): Promise<EscoSkillEntity[]> {
    if (codes.length === 0) return Promise.resolve([]);
    return this.repo.find({ where: { code: In(codes) } });
  }

  findAll(limit = 100, offset = 0): Promise<EscoSkillEntity[]> {
    return this.repo.find({
      take: limit,
      skip: offset,
      order: { code: 'ASC' },
    });
  }

  count(): Promise<number> {
    return this.repo.count();
  }

  /** All skills whose iscoLinks include the given ISCO-08 code. */
  findByIscoLink(isco: string): Promise<EscoSkillEntity[]> {
    return this.repo
      .createQueryBuilder('s')
      .where(':isco = ANY(s.iscoLinks)', { isco })
      .getMany();
  }

  /** Returns the set of valid codes — used to validate model output. */
  async loadValidCodes(): Promise<Set<string>> {
    const rows = await this.repo.find({ select: { code: true } });
    return new Set(rows.map((r) => r.code));
  }
}
