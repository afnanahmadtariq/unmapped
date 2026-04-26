import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Mean monthly wage by ISCO-08 occupation, per country. */
@Entity({ name: 'wages_by_isco' })
@Index('wages_country_isco_uq', ['countryCode', 'iscoCode'], { unique: true })
export class WageEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ type: 'varchar', length: 4 })
  countryCode!: string;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  iscoCode!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 8 })
  currency!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  vintage!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'snapshot' })
  source!: string;

  /** FK-by-convention to dataset_runs.id; nullable for legacy / seed rows. */
  @Index('wages_run_idx')
  @Column({ type: 'uuid', nullable: true })
  runId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
