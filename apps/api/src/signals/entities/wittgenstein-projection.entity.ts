import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Wittgenstein Centre education projection.
 * One row per (iso3, year, scenario, educLevel, sex, ageGroup) — broad
 * enough that the dashboard can compute "share of working age population
 * with at least upper secondary in 2030", etc.
 */
@Entity({ name: 'wittgenstein_projections' })
@Index(
  'wcde_natural_key_uq',
  ['iso3', 'year', 'scenario', 'educLevel', 'sex', 'ageGroup'],
  { unique: true },
)
export class WittgensteinProjectionEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ type: 'varchar', length: 8 })
  iso3!: string;

  @Index()
  @Column({ type: 'integer' })
  year!: number;

  @Column({ type: 'varchar', length: 32, default: '' })
  scenario!: string;

  @Column({ type: 'varchar', length: 32, default: '' })
  educLevel!: string;

  @Column({ type: 'varchar', length: 16, default: '' })
  sex!: string;

  @Column({ type: 'varchar', length: 16, default: '' })
  ageGroup!: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  population!: string | null;

  @Index('wcde_run_idx')
  @Column({ type: 'uuid', nullable: true })
  runId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
