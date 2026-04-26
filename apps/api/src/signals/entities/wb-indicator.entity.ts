import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Time-series points harvested from the World Bank WDI API. */
@Entity({ name: 'wb_indicator_points' })
@Index('wb_idx_iso_indicator_year', ['iso3', 'indicator', 'year'], {
  unique: true,
})
export class WbIndicatorPointEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 4 })
  iso3!: string;

  @Column({ type: 'varchar', length: 64 })
  indicator!: string;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'numeric', precision: 30, scale: 6 })
  value!: string;

  @Column({ type: 'varchar', length: 32, default: 'wb' })
  source!: string;

  @Index('wb_indicator_run_idx')
  @Column({ type: 'uuid', nullable: true })
  runId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
