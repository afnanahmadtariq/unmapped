import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

/**
 * One row per `(user, countryCode)` — captures everything a user has
 * generated via the wizard so a returning visitor can see refreshed
 * insights without re-typing.
 *
 *   - `extractInput`     — the raw form payload (countryCode, story,
 *                          declared skills, demographics, context, …).
 *   - `skillsProfile`    — the SkillsProfile object the AI returned
 *                          (skills, narrative, confidence, …).
 *   - `matches`          — the most recent /profile/match output.
 *   - `opportunities`    — the most recent /profile/opportunities output.
 *   - `signals`          — the most recent /signals/composite snapshot.
 *
 * All four match-related blobs are best-effort caches. The web layer
 * recomputes them on next login, but storing them makes login feel
 * instant and gives us a comparison point for "what changed".
 *
 * The unique index lets us upsert on `(userId, countryCode)` so the
 * "Update profile" flow stays idempotent.
 */
@Entity({ name: 'user_profiles' })
@Index('user_profiles_user_country_uq', ['userId', 'countryCode'], {
  unique: true,
})
@Index('user_profiles_country_idx', ['countryCode'])
export class UserProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, (u) => u.profiles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ type: 'varchar', length: 4 })
  countryCode!: string;

  @Column({ type: 'jsonb' })
  extractInput!: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  skillsProfile!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  matches!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  opportunities!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  signals!: Record<string, unknown> | null;

  /**
   * ISCO codes the matcher returned, denormalised so we can run
   * "competition" overlap queries without unpacking the JSONB blob.
   */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  iscoCodes!: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
