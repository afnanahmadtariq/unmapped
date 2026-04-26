import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfileEntity } from './user-profile.entity';

export interface UpsertProfileInput {
  countryCode: string;
  extractInput: Record<string, unknown>;
  skillsProfile: Record<string, unknown>;
  matches?: Record<string, unknown> | null;
  opportunities?: Record<string, unknown> | null;
  signals?: Record<string, unknown> | null;
  iscoCodes?: string[];
}

export interface PublicUserProfile {
  id: string;
  userId: string;
  countryCode: string;
  extractInput: Record<string, unknown>;
  skillsProfile: Record<string, unknown>;
  matches: Record<string, unknown> | null;
  opportunities: Record<string, unknown> | null;
  signals: Record<string, unknown> | null;
  iscoCodes: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * One row per (userId, countryCode). Upsert semantics let the wizard's
 * "Update profile" flow re-run without bookkeeping on the client side.
 *
 * `iscoCodes` is denormalised so the competition-overlap query stays a
 * cheap GIN/array index hit instead of a JSONB unpack — the matcher's
 * full output is preserved in `matches` for full fidelity.
 */
@Injectable()
export class UserProfilesService {
  private readonly logger = new Logger(UserProfilesService.name);

  constructor(
    @InjectRepository(UserProfileEntity)
    private readonly profiles: Repository<UserProfileEntity>,
  ) {}

  async list(userId: string): Promise<PublicUserProfile[]> {
    const rows = await this.profiles.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  async getOne(
    userId: string,
    countryCode: string,
  ): Promise<PublicUserProfile> {
    const row = await this.profiles.findOne({
      where: { userId, countryCode: this.normalizeCountry(countryCode) },
    });
    if (!row) throw new NotFoundException('No saved profile for that country');
    return this.toPublic(row);
  }

  async findOne(
    userId: string,
    countryCode: string,
  ): Promise<PublicUserProfile | null> {
    const row = await this.profiles.findOne({
      where: { userId, countryCode: this.normalizeCountry(countryCode) },
    });
    return row ? this.toPublic(row) : null;
  }

  async upsert(
    userId: string,
    input: UpsertProfileInput,
  ): Promise<PublicUserProfile> {
    const countryCode = this.normalizeCountry(input.countryCode);
    const existing = await this.profiles.findOne({
      where: { userId, countryCode },
    });
    const iscoCodes = this.dedupeIscoCodes(
      input.iscoCodes ?? this.extractIscoCodes(input.matches ?? null),
    );
    if (existing) {
      existing.extractInput = input.extractInput;
      existing.skillsProfile = input.skillsProfile;
      existing.matches = input.matches ?? existing.matches;
      existing.opportunities = input.opportunities ?? existing.opportunities;
      existing.signals = input.signals ?? existing.signals;
      existing.iscoCodes = iscoCodes;
      const saved = await this.profiles.save(existing);
      this.logger.log(
        `Updated profile for user=${userId} country=${countryCode}.`,
      );
      return this.toPublic(saved);
    }
    const created = await this.profiles.save(
      this.profiles.create({
        userId,
        countryCode,
        extractInput: input.extractInput,
        skillsProfile: input.skillsProfile,
        matches: input.matches ?? null,
        opportunities: input.opportunities ?? null,
        signals: input.signals ?? null,
        iscoCodes,
      }),
    );
    this.logger.log(
      `Created profile for user=${userId} country=${countryCode}.`,
    );
    return this.toPublic(created);
  }

  async delete(userId: string, countryCode: string): Promise<{ deleted: number }> {
    const result = await this.profiles.delete({
      userId,
      countryCode: this.normalizeCountry(countryCode),
    });
    return { deleted: result.affected ?? 0 };
  }

  /**
   * Anonymised count of OTHER users in the same country whose stored
   * matches share at least one ISCO code with the given profile.
   *
   * Returned as `{ overlap, total, sharedCodes }` so the UI can phrase
   * "12 of 84 active users in your country share at least one occupation
   * with you" without identifying anyone.
   */
  async competitionOverlap(
    userId: string,
    countryCode: string,
  ): Promise<{
    overlap: number;
    total: number;
    sharedCodes: { iscoCode: string; count: number }[];
  }> {
    const cc = this.normalizeCountry(countryCode);
    const me = await this.profiles.findOne({
      where: { userId, countryCode: cc },
    });
    if (!me || me.iscoCodes.length === 0) {
      return { overlap: 0, total: 0, sharedCodes: [] };
    }
    const others = await this.profiles
      .createQueryBuilder('p')
      .where('p.countryCode = :cc', { cc })
      .andWhere('p.userId <> :userId', { userId })
      .getMany();
    const total = others.length;
    let overlap = 0;
    const counts = new Map<string, number>();
    for (const other of others) {
      const shared = other.iscoCodes.filter((c) => me.iscoCodes.includes(c));
      if (shared.length > 0) overlap += 1;
      for (const code of shared) {
        counts.set(code, (counts.get(code) ?? 0) + 1);
      }
    }
    const sharedCodes = Array.from(counts.entries())
      .map(([iscoCode, count]) => ({ iscoCode, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    return { overlap, total, sharedCodes };
  }

  private normalizeCountry(code: string): string {
    return code.trim().toUpperCase();
  }

  private extractIscoCodes(
    matches: Record<string, unknown> | null,
  ): string[] {
    if (!matches) return [];
    const candidate = (matches as { matches?: unknown }).matches;
    if (!Array.isArray(candidate)) return [];
    const codes: string[] = [];
    for (const m of candidate) {
      if (m && typeof m === 'object') {
        const code = (m as { iscoCode?: unknown }).iscoCode;
        if (typeof code === 'string' && code.trim().length > 0) {
          codes.push(code.trim());
        }
      }
    }
    return codes;
  }

  private dedupeIscoCodes(codes: string[]): string[] {
    return Array.from(new Set(codes.map((c) => c.trim()).filter(Boolean)));
  }

  private toPublic(row: UserProfileEntity): PublicUserProfile {
    return {
      id: row.id,
      userId: row.userId,
      countryCode: row.countryCode,
      extractInput: row.extractInput,
      skillsProfile: row.skillsProfile,
      matches: row.matches,
      opportunities: row.opportunities,
      signals: row.signals,
      iscoCodes: row.iscoCodes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
