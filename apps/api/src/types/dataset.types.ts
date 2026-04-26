/** Consistent schema for every saved dataset */
export interface HarvestedDataset {
  sourceId: string;
  sourceName: string;
  category: 'labor' | 'education' | 'automation' | 'skills';
  lastFetched: string;        // ISO 8601
  nextScheduled: string;      // ISO 8601
  cronExpression: string;
  recordCount: number;
  fields: string[];           // column names
  metadata: Record<string, any>;
  records: Record<string, any>[];
}
