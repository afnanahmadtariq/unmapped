export interface Embedder {
  /** The model name (for logging / metadata). */
  readonly model: string;
  /** The dimensionality of returned vectors (must match Milvus collection dim). */
  readonly dim: number;
  /** Embed text. Use kind='document' for ingest, 'query' for retrieval. */
  embed(texts: string[], kind: 'document' | 'query'): Promise<number[][]>;
}

export const EMBEDDER = Symbol('EMBEDDER');
