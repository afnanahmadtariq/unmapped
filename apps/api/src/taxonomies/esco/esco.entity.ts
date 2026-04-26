import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Postgres mirror of the ESCO skills taxonomy. The textual `description`
 * column is what gets embedded into Milvus; everything else stays here.
 */
@Entity({ name: 'esco_skills' })
export class EscoSkillEntity {
  /** Stable code, e.g. 'S1.0.1' for snapshot rows or the ESCO URI hash for live. */
  @PrimaryColumn({ type: 'varchar', length: 128 })
  code!: string;

  @Index('esco_skills_label_idx')
  @Column({ type: 'text' })
  label!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Human-readable cluster, e.g. 'digital', 'trades', 'transversal'. */
  @Index('esco_skills_category_idx')
  @Column({ type: 'varchar', length: 64, default: 'general' })
  category!: string;

  /** ISCO-08 occupation codes this skill maps to. */
  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  iscoLinks!: string[];

  /** Where the row came from: 'snapshot' (seed) or 'esco-live' (harvester). */
  @Column({ type: 'varchar', length: 32, default: 'snapshot' })
  source!: string;

  /** Original ESCO URI when source='esco-live'. */
  @Column({ type: 'text', nullable: true })
  uri!: string | null;

  /** True after the row's vector has been pushed to Milvus. */
  @Column({ type: 'boolean', default: false })
  embedded!: boolean;

  @Index('esco_skills_run_idx')
  @Column({ type: 'uuid', nullable: true })
  runId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
