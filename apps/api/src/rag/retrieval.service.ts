import { Injectable, Logger } from '@nestjs/common';
import { EscoSearchService } from '../taxonomies/esco/esco-search.service';
import { EscoSkillEntity } from '../taxonomies/esco/esco.entity';
import { OnetSearchService } from '../signals/onet-search.service';
import { OnetTaskEntity } from '../signals/entities/onet-task.entity';

export interface RetrievedSkill {
  code: string;
  label: string;
  category: string;
  iscoLinks: string[];
  description: string | null;
  score: number;
  source: 'esco';
}

export interface RetrievedTask {
  onetCode: string;
  taskId: string;
  statement: string;
  taskType: string;
  iscoCode: string | null;
  importance: number | null;
  level: number | null;
  score: number;
  source: 'onet';
}

export type RetrievedItem = RetrievedSkill | RetrievedTask;

export type RetrievalCorpus = 'esco' | 'onet';

/**
 * The "Retrieval" half of RAG. Sits in front of the ESCO + O*NET Milvus
 * indexes (and the Postgres mirrors), hides the join, and produces a
 * small, hydrated set of candidates that can be inlined into a Claude
 * prompt.
 *
 * `retrieveSkillsForStory` is the production entry point used by
 * profile/extract; `retrieveItemsForStory` exposes the multi-corpus
 * variant used by RagService.buildExtractContext when both ESCO skills
 * and O*NET tasks are useful (e.g. opportunity matching, narrative
 * explanation).
 */
@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly esco: EscoSearchService,
    private readonly onet: OnetSearchService,
  ) {}

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
      source: 'esco' as const,
    }));
  }

  /**
   * Multi-corpus retrieval. Fan out across the requested vector
   * collections (`esco`, `onet` today; `policy_reports`, `training_programs`
   * once Phase 5 lands) and merge by score.
   */
  async retrieveItemsForStory(
    story: string,
    declared: string[] = [],
    opts: { corpora?: RetrievalCorpus[]; k?: number } = {},
  ): Promise<RetrievedItem[]> {
    const corpora: RetrievalCorpus[] = opts.corpora ?? ['esco', 'onet'];
    const k = opts.k ?? 24;
    const queries = this.buildQueries(story, declared);
    const out: RetrievedItem[] = [];

    if (corpora.includes('esco')) {
      const merged = new Map<string, { row: EscoSkillEntity; score: number }>();
      for (const q of queries) {
        try {
          const hits = await this.esco.semanticSearch(q, k);
          for (const h of hits) {
            const prev = merged.get(h.skill.code);
            if (!prev || h.score > prev.score) {
              merged.set(h.skill.code, { row: h.skill, score: h.score });
            }
          }
        } catch (err) {
          this.logger.warn(`ESCO retrieval failed: ${(err as Error).message}`);
        }
      }
      for (const { row, score } of merged.values()) {
        out.push({
          code: row.code,
          label: row.label,
          category: row.category,
          iscoLinks: row.iscoLinks ?? [],
          description: row.description ?? null,
          score,
          source: 'esco',
        });
      }
    }

    if (corpora.includes('onet')) {
      const merged = new Map<string, { row: OnetTaskEntity; score: number }>();
      for (const q of queries) {
        try {
          const hits = await this.onet.semanticSearch(q, k);
          for (const h of hits) {
            const key = `${h.task.onetCode}:${h.task.taskId}`;
            const prev = merged.get(key);
            if (!prev || h.score > prev.score) {
              merged.set(key, { row: h.task, score: h.score });
            }
          }
        } catch (err) {
          this.logger.warn(
            `O*NET retrieval failed: ${(err as Error).message}`,
          );
        }
      }
      for (const { row, score } of merged.values()) {
        out.push({
          onetCode: row.onetCode,
          taskId: row.taskId,
          statement: row.statement,
          taskType: row.taskType,
          iscoCode: row.iscoCode ?? null,
          importance:
            row.importance === null || row.importance === undefined
              ? null
              : Number(row.importance),
          level:
            row.level === null || row.level === undefined
              ? null
              : Number(row.level),
          score,
          source: 'onet',
        });
      }
    }

    return out.sort((a, b) => b.score - a.score).slice(0, k);
  }

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
