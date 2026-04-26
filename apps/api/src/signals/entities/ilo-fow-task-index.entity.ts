import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * ILO Future-of-Work task indices: routine, non-routine, manual,
 * cognitive, AI exposure. Indexed by ISCO code (2-, 3- or 4-digit).
 */
@Entity({ name: 'ilo_fow_task_indices' })
@Index('ilo_fow_natural_key_uq', ['iscoCode', 'metric', 'year'], {
  unique: true,
})
export class IloFowTaskIndexEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ type: 'varchar', length: 8 })
  iscoCode!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  metric!: string;

  @Column({ type: 'integer', nullable: true })
  year!: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  value!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note!: string | null;

  @Index('ilo_fow_run_idx')
  @Column({ type: 'uuid', nullable: true })
  runId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
