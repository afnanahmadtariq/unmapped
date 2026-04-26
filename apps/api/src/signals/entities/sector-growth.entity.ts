import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Year-over-year sector employment growth, per country. */
@Entity({ name: 'sector_growth' })
@Index('sector_growth_country_sector_uq', ['countryCode', 'sectorId'], {
  unique: true,
})
export class SectorGrowthEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ type: 'varchar', length: 4 })
  countryCode!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  sectorId!: string;

  @Column({ type: 'numeric', precision: 6, scale: 3 })
  yoyPercent!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  vintage!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'snapshot' })
  source!: string;

  @Index('sector_growth_run_idx')
  @Column({ type: 'uuid', nullable: true })
  runId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
