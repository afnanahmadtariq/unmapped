import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * UN Population Division indicator points (DataPortal). A single row
 * stands in for an (iso, indicator, sex, ageGroup, year) tuple so we can
 * surface working-age share, dependency ratio, etc. without re-fetching.
 */
@Entity({ name: 'un_population_points' })
@Index(
  'un_pop_natural_key_uq',
  ['iso3', 'indicator', 'sex', 'ageGroup', 'year'],
  { unique: true },
)
export class UnPopulationEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ type: 'varchar', length: 8 })
  iso3!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  indicator!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  indicatorName!: string | null;

  @Column({ type: 'varchar', length: 16, default: '' })
  sex!: string;

  @Column({ type: 'varchar', length: 16, default: '' })
  ageGroup!: string;

  @Index()
  @Column({ type: 'integer' })
  year!: number;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  value!: string | null;

  @Index('un_pop_run_idx')
  @Column({ type: 'uuid', nullable: true })
  runId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
