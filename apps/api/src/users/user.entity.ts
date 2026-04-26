import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserProfileEntity } from './user-profile.entity';

/**
 * Optional, hackathon-grade user accounts.
 *
 * Distinct from the single-admin auth model (`AuthModule`):
 *   - Multi-user: one row per signup, identified by lower-cased email.
 *   - Bcrypt password hash stored alongside the row (never the plaintext).
 *   - Sessions live in the `cartographer_user_session` cookie (separate from
 *     `cartographer_admin_session` so admin + user sessions never collide).
 *
 * Every user owns zero-or-more `UserProfileEntity` rows — one per country
 * they've run the wizard for. Cascade-deletes on user removal.
 */
@Entity({ name: 'users' })
@Index('users_email_uq', ['email'], { unique: true })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  displayName!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  passwordHash!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => UserProfileEntity, (p) => p.user, {
    cascade: ['insert', 'update', 'remove'],
  })
  profiles!: UserProfileEntity[];
}
