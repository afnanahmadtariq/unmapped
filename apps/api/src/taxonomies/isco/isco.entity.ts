import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * ISCO-08 occupation classification. Postgres-only by plan.md decision rule:
 * codes + structure are categorical, not semantic.
 */
@Entity({ name: 'isco_occupations' })
export class IscoOccupationEntity {
  /** ISCO-08 code, e.g. '7421'. */
  @PrimaryColumn({ type: 'varchar', length: 16 })
  code!: string;

  @Index('isco_title_idx')
  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'int', nullable: true })
  skillLevel!: number | null;

  /** Internal sector key, e.g. 'ICT', 'CONSTRUCTION', 'AGRICULTURE'. */
  @Index('isco_sector_idx')
  @Column({ type: 'varchar', length: 64, nullable: true })
  sectorId!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'snapshot' })
  source!: string;

  @Index('isco_run_idx')
  @Column({ type: 'uuid', nullable: true })
  runId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
