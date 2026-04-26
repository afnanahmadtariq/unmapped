import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * ITU Digital indicators: broadband subscription rate, internet usage
 * rate, mobile coverage. Used to derive E.regional digital divide signals.
 */
@Entity({ name: 'itu_digital_observations' })
@Index('itu_digital_natural_key_uq', ['iso3', 'indicator', 'year'], {
  unique: true,
})
export class ItuDigitalEntity {
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

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  value!: string | null;

  @Index('itu_digital_run_idx')
  @Column({ type: 'uuid', nullable: true })
  runId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
