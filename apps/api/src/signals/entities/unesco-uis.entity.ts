import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * UNESCO UIS education observation: enrollment, completion, financing,
 * literacy, etc. Used to derive education attainment + financing signals.
 */
@Entity({ name: 'unesco_uis_observations' })
@Index('uis_natural_key_uq', ['iso3', 'indicator', 'year'], { unique: true })
export class UnescoUisEntity {
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

  @Index()
  @Column({ type: 'integer' })
  year!: number;

  @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true })
  value!: string | null;

  @Index('uis_run_idx')
  @Column({ type: 'uuid', nullable: true })
  runId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
