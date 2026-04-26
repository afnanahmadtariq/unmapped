import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Generic structured-data table for admin uploads that target a custom
 * source slug without a hard-wired entity (e.g. `isco-pakistan`,
 * `china-edu-stats`, `kenya-tvet-graduates`).
 *
 * Every row stores:
 *   - `sourceSlug` so the data can be queried per source.
 *   - `runId` so deletion cascades through `LineageService`.
 *   - `record` as a JSONB blob with whatever fields the source's
 *     `schemaSpec` declared (validated + coerced upstream).
 *   - `recordKey` (optional) — when an admin marks a column as the
 *     natural key in the schemaSpec we'll use it for upsert dedup.
 *
 * This means new sources are queryable + cascade-safe immediately, no
 * migration required. Specialised entities still take precedence in the
 * loader switch — `custom_records` is the long-tail fallback.
 */
@Entity({ name: 'custom_records' })
@Index('custom_records_source_idx', ['sourceSlug'])
@Index('custom_records_run_idx', ['runId'])
@Index('custom_records_natural_key_uq', ['sourceSlug', 'recordKey'], {
  unique: true,
  where: '"recordKey" IS NOT NULL',
})
export class CustomRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  sourceSlug!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recordKey!: string | null;

  @Column({ type: 'jsonb' })
  record!: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  runId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
