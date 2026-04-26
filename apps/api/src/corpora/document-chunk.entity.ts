import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A single chunk of a long-form document (policy report, training program
 * description, admin-uploaded custom corpus, etc.) stored as the
 * authoritative copy alongside its Milvus embedding. Identified by
 * `chunkId = <documentId>:<chunkIndex>`, which is also the Milvus primary
 * key — so cascade deletion can fan out by id list.
 *
 * `corpus` is a string identifier; for first-party RAG corpora it matches
 * `DocumentCorpus` (`policy_reports`, `training_programs`), and for
 * admin-defined sources it equals the source slug.
 */
@Entity({ name: 'document_chunks' })
@Index('document_chunk_natural_key_uq', ['corpus', 'documentId', 'chunkIndex'], {
  unique: true,
})
export class DocumentChunkEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  corpus!: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  documentId!: string;

  @Column({ type: 'int' })
  chunkIndex!: number;

  @Column({ type: 'varchar', length: 256, default: '' })
  title!: string;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Index('document_chunk_run_idx')
  @Column({ type: 'uuid', nullable: true })
  runId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
