/**
 * Loose union of dataset categories — narrow ones reflect known harvesters,
 * the open string keeps room for new uploads / future sources without a
 * cross-cutting type change.
 */
export type DatasetCategory =
  | 'labor'
  | 'education'
  | 'automation'
  | 'skills'
  | 'connectivity'
  | 'manual'
  | (string & {});

/** Consistent schema for every saved dataset */
export interface HarvestedDataset {
  sourceId: string;
  sourceName: string;
  category: DatasetCategory;
  lastFetched: string; // ISO 8601
  nextScheduled: string; // ISO 8601
  cronExpression: string;
  recordCount: number;
  fields: string[]; // column names
  metadata: Record<string, any>;
  records: Record<string, any>[];
}
