import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Time series of ILOSTAT indicator observations. Keyed on
 * `(refArea, indicatorId, sex, classif1, time)` to support gendered +
 * sectoral breakdowns. Year is stored as a string because some ILOSTAT
 * payloads emit `2023M01` (monthly) or `2023Q1` (quarterly) — the parsing
 * is preserved verbatim for downstream signals.
 */
@Entity({ name: 'ilostat_time_series' })
@Index(
  'ilostat_natural_key_uq',
  ['refArea', 'indicatorId', 'sex', 'classif1', 'time'],
  { unique: true },
)
export class IlostatTimeSeriesEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  refArea!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  indicatorId!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  indicatorName!: string | null;

  @Column({ type: 'varchar', length: 32, default: '' })
  sex!: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  classif1!: string;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  time!: string;

  @Column({ type: 'integer', nullable: true })
  year!: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  value!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  obsStatus!: string | null;

  @Index('ilostat_run_idx')
  @Column({ type: 'uuid', nullable: true })
  runId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
