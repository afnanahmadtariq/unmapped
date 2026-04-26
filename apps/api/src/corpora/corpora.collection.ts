/**
 * Single source of truth for the auxiliary RAG Milvus collection names.
 *
 * `policy_reports` and `training_programs` are populated exclusively via
 * the admin upload endpoint (Phase 5) — there is no public harvester
 * because the documents are typically curated PDFs / markdown.
 */
export const POLICY_REPORTS_COLLECTION = 'policy_reports';
export const TRAINING_PROGRAMS_COLLECTION = 'training_programs';

export type DocumentCorpus = 'policy_reports' | 'training_programs';

export const DOCUMENT_CORPORA: DocumentCorpus[] = [
  'policy_reports',
  'training_programs',
];
