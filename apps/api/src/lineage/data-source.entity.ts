import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Catalog of every "thing that produces rows": a scheduled harvester or
 * an upload-only slot. Every persisted row in Postgres + every Milvus
 * payload carries a `runId` that ultimately resolves back to one of these.
 */
@Entity({ name: 'data_sources' })
@Index('data_sources_slug_uq', ['slug'], { unique: true })
export class DataSourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable identifier matching `BaseHarvester.sourceId` for harvesters
   * (e.g. `esco`, `wb-wdi`) or any unique slug for upload-only sources. */
  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  /** Friendly label for the admin UI. */
  @Column({ type: 'varchar', length: 200 })
  displayName!: string;

  /** `harvester` = pulled by a cron decorator; `upload` = file drop only. */
  @Column({ type: 'varchar', length: 16, default: 'harvester' })
  kind!: 'harvester' | 'upload';

  /** Public fetch URL or HTML landing page. Editable from the admin UI. */
  @Column({ type: 'text', nullable: true })
  sourceUrl!: string | null;

  /** Cron expression for harvester sources; null for upload-only. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  cron!: string | null;

  /** When false, the harvester is registered but skipped by cron + manual triggers. */
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  /** Free-form category tag mirroring `HarvestedDataset.category`. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  category!: string | null;

  /** Optional zod-shaped column spec for upload validation. Stored as JSON. */
  @Column({ type: 'jsonb', nullable: true })
  schemaSpec!: Record<string, unknown> | null;

  /** Last admin-recorded note about the source — surfaced in the UI. */
  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
