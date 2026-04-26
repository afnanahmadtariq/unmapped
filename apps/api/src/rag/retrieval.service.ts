import { Injectable, Logger } from '@nestjs/common';
import { EscoSearchService } from '../taxonomies/esco/esco-search.service';
import { EscoSkillEntity } from '../taxonomies/esco/esco.entity';

export interface RetrievedSkill {
  code: string;
  label: string;
  category: string;
  iscoLinks: string[];
  description: string | null;
  score: number;
}

/**
 * The "Retrieval" half of RAG. Sits in front of the ESCO Milvus index and
 * the Postgres mirror, hides the join, and produces a small, hydrated set
 * of candidates that can be inlined into a Claude prompt.
 *
 * `retrieveSkillsForStory` is the production entry point used by
 * profile/extract. The other helpers exist so dashboards / explanation
 * narratives can reuse the same pattern in future.
 */
@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(private readonly esco: EscoSearchService) {}

  async retrieveSkillsForStory(
    story: string,
    declared: string[] = [],
    k = 24,
  ): Promise<RetrievedSkill[]> {
    const queries = this.buildQueries(story, declared);
    const merged = new Map<string, { row: EscoSkillEntity; score: number }>();
    for (const q of queries) {
      const hits = await this.esco.semanticSearch(q, k);
      for (const h of hits) {
        const prev = merged.get(h.skill.code);
        if (!prev || h.score > prev.score) {
          merged.set(h.skill.code, { row: h.skill, score: h.score });
        }
      }
    }
    const ranked = Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
    return ranked.map(({ row, score }) => ({
      code: row.code,
      label: row.label,
      category: row.category,
      iscoLinks: row.iscoLinks ?? [],
      description: row.description ?? null,
      score,
    }));
  }

  /**
   * Build the family of retrieval queries: the user story, then each
   * declared skill term, then a generic LMIC-context anchor for transversals.
   * Keeping queries short focuses the embedding on the right surface form.
   */
  private buildQueries(story: string, declared: string[]): string[] {
    const out: string[] = [];
    const trimmed = (story ?? '').trim();
    if (trimmed.length > 0) out.push(trimmed);
    for (const d of declared) {
      const t = (d ?? '').trim();
      if (t.length > 0 && t.length < 80) out.push(t);
    }
    if (out.length === 0)
      out.push('basic transversal skills problem solving teamwork');
    return out;
  }
}
