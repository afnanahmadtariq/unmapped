import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * O*NET task statement. The text body is also embedded into the
 * `onet_tasks` Milvus collection for retrieval-augmented matching.
 */
@Entity({ name: 'onet_tasks' })
@Index('onet_task_natural_key_uq', ['onetCode', 'taskId'], { unique: true })
export class OnetTaskEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  onetCode!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  taskId!: string;

  @Column({ type: 'text' })
  statement!: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  importance!: string | null;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  level!: string | null;

  @Column({ type: 'varchar', length: 16, default: '' })
  taskType!: string;

  @Column({ type: 'varchar', length: 8, nullable: true })
  iscoCode!: string | null;

  @Index('onet_task_run_idx')
  @Column({ type: 'uuid', nullable: true })
  runId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
