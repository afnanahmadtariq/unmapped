import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DataSourceEntity } from './data-source.entity';

export type DatasetRunStatus = 'pending' | 'ok' | 'failed';
export type DatasetRunKind =
  | 'cron'
  | 'manual'
  | 'upload'
  | 'seed'
  | 'startup';

/**
 * One row per harvest invocation (cron, manual, or admin file upload).
 * `runId` is propagated as a string column on every persisted entity so
 * that LineageService.deleteRun can fan out and remove derived rows
 * from Postgres, Milvus and the disk archive in a single transaction.
 */
@Entity({ name: 'dataset_runs' })
@Index('dataset_runs_source_started_idx', ['dataSourceId', 'startedAt'])
export class DatasetRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  dataSourceId!: string;

  @ManyToOne(() => DataSourceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dataSourceId' })
  dataSource!: DataSourceEntity;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: DatasetRunStatus;

  @Column({ type: 'varchar', length: 16, default: 'cron' })
  kind!: DatasetRunKind;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  recordCount!: number;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  /** Absolute path to the JSON archive of the harvested payload. */
  @Column({ type: 'text', nullable: true })
  archivePath!: string | null;

  /** SHA-256 of the upload payload, when the run originated from a file. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  fileChecksum!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  filename!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
