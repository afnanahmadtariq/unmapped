import { Injectable, Logger } from '@nestjs/common';
import {
  RetrievalService,
  type RetrievalCorpus,
  type RetrievedItem,
  type RetrievedSkill,
  type RetrievedTask,
} from './retrieval.service';
import {
  CorporaSearchService,
  type CorpusVectorHit,
} from '../corpora/corpora-search.service';
import type { DocumentCorpus } from '../corpora/corpora.collection';
import { AnthropicClient } from '../infra/anthropic/anthropic.client';

export type ExtractCorpus = RetrievalCorpus | DocumentCorpus;

export interface ExtractRetrievalContext {
  /** Compact one-line list, ready to inline into a Claude system prompt. */
  inlineList: string;
  /** Full structured rows for downstream callers (e.g. matcher pre-filter). */
  rows: RetrievedSkill[];
  /** Cross-corpus retrieved items when corpora include `onet`/`policy`/etc. */
  items: ExtractRetrievedItem[];
}

export type ExtractRetrievedItem =
  | RetrievedSkill
  | RetrievedTask
  | RetrievedDocument;

export interface RetrievedDocument {
  source: 'policy_reports' | 'training_programs';
  documentId: string;
  chunkIndex: number;
  title: string;
  text: string;
  metadata: Record<string, unknown> | null;
  score: number;
}

export interface ExplainInput {
  question: string;
  countryCode?: string;
  iscoCode?: string | null;
  corpora?: ExtractCorpus[];
  topK?: number;
}

export interface ExplainResult {
  answer: string;
  citations: ExtractRetrievedItem[];
  modelUsed: string;
}

/**
 * Orchestrates retrieval for downstream LLM calls. The contract is:
 *   - "buildExtractContext" returns a slimmed retrieval bundle relevant to
 *     the user story + declared skills, replacing the static ESCO_LIST that
 *     used to be crammed into the prompt in `apps/web/lib/llm.ts`.
 *   - "explain" is the narrative endpoint: it pulls multi-corpus
 *     evidence (ESCO + O*NET + policy_reports + training_programs) and
 *     asks Claude for a citation-grounded paragraph, mirroring the
 *     "Narrative Layer" the plan calls for.
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly retrieval: RetrievalService,
    private readonly corpora: CorporaSearchService,
    private readonly anthropic: AnthropicClient,
  ) {}

  async buildExtractContext(input: {
    story: string;
    declaredSkills?: string[];
    k?: number;
    corpora?: ExtractCorpus[];
  }): Promise<ExtractRetrievalContext> {
    const corpora = input.corpora ?? ['esco'];
    const k = input.k ?? 24;
    const rows = await this.retrieval.retrieveSkillsForStory(
      input.story ?? '',
      input.declaredSkills ?? [],
      k,
    );
    const inlineList = rows
      .map(
        (r) =>
          `${r.code} | ${r.label} | ${r.category} | ISCO: [${r.iscoLinks.join(', ')}]`,
      )
      .join('\n');

    const taxonomyCorpora = corpora.filter(
      (c): c is RetrievalCorpus => c === 'esco' || c === 'onet',
    );
    const docCorpora = corpora.filter(
      (c): c is DocumentCorpus =>
        c === 'policy_reports' || c === 'training_programs',
    );

    let items: ExtractRetrievedItem[] = [];
    if (taxonomyCorpora.length > 0) {
      const fanned = await this.retrieval.retrieveItemsForStory(
        input.story ?? '',
        input.declaredSkills ?? [],
        { corpora: taxonomyCorpora, k },
      );
      items = items.concat(fanned);
    }
    for (const corpus of docCorpora) {
      try {
        const hits = await this.corpora.semanticSearch(
          corpus,
          this.composeQuery(input.story ?? '', input.declaredSkills ?? []),
          Math.min(k, 12),
        );
        items = items.concat(hits.map((h) => this.toRetrievedDocument(corpus, h)));
      } catch (err) {
        this.logger.warn(
          `Corpus ${corpus} retrieval failed: ${(err as Error).message}`,
        );
      }
    }
    items.sort((a, b) => b.score - a.score);
    if (items.length > k) items = items.slice(0, k);

    return { inlineList, rows, items };
  }

  /**
   * Narrative layer. Retrieves cross-corpus evidence and asks Claude for a
   * grounded explanation. We *intentionally* keep the prompt small and the
   * answer short so this is cheap to call from the dashboard (e.g. "Why is
   * automation risk high here?", "What training pathways are available?").
   */
  async explain(input: ExplainInput): Promise<ExplainResult> {
    const corpora: ExtractCorpus[] = input.corpora ?? [
      'esco',
      'onet',
      'policy_reports',
      'training_programs',
    ];
    const k = input.topK ?? 12;

    const ctx = await this.buildExtractContext({
      story: input.question,
      declaredSkills: [],
      k,
      corpora,
    });
    const items = ctx.items.length > 0 ? ctx.items : ctx.rows;

    const evidence = items
      .map((item, idx) => `[${idx + 1}] ${this.renderItem(item)}`)
      .join('\n');

    const system = [
      'You are UNMAPPED\'s narrative layer. Produce a concise, neutral, citation-grounded answer.',
      'Cite evidence with [1], [2], … using the bracketed numbers from the EVIDENCE block.',
      'If the evidence does not cover the question, say so plainly. Do not invent statistics.',
      'Keep the answer under 180 words. Do not include a separate "References" section.',
    ].join(' ');

    const userParts: string[] = [];
    if (input.countryCode) userParts.push(`Country: ${input.countryCode}`);
    if (input.iscoCode) userParts.push(`ISCO occupation: ${input.iscoCode}`);
    userParts.push(`Question: ${input.question}`);
    userParts.push('EVIDENCE:');
    userParts.push(evidence || '(no evidence retrieved)');

    let answer = '';
    try {
      const resp = await this.anthropic.raw().messages.create({
        model: this.anthropic.model,
        max_tokens: 600,
        temperature: 0.2,
        system,
        messages: [{ role: 'user', content: userParts.join('\n\n') }],
      });
      const block = resp.content.find((b) => b.type === 'text');
      answer = block && 'text' in block ? block.text.trim() : '';
    } catch (err) {
      this.logger.warn(`Anthropic explain failed: ${(err as Error).message}`);
      answer = `Unable to call the narrative model: ${(err as Error).message}.`;
    }

    return {
      answer,
      citations: items,
      modelUsed: this.anthropic.model,
    };
  }

  private composeQuery(story: string, declared: string[]): string {
    const parts = [story?.trim(), ...declared].filter(
      (s): s is string => !!s && s.trim().length > 0,
    );
    return parts.join(' ').slice(0, 800);
  }

  private toRetrievedDocument(
    corpus: DocumentCorpus,
    hit: CorpusVectorHit,
  ): RetrievedDocument {
    return {
      source: corpus,
      documentId: hit.chunk.documentId,
      chunkIndex: hit.chunk.chunkIndex,
      title: hit.chunk.title,
      text: hit.chunk.text,
      metadata: hit.chunk.metadata,
      score: hit.score,
    };
  }

  private renderItem(item: ExtractRetrievedItem): string {
    if ('source' in item && item.source === 'esco') {
      const skill = item as RetrievedSkill;
      return `ESCO ${skill.code} — ${skill.label} (${skill.category})${
        skill.description ? `. ${skill.description}` : ''
      }`;
    }
    if ('source' in item && item.source === 'onet') {
      const task = item as RetrievedTask;
      return `O*NET ${task.onetCode}/${task.taskId} (${task.taskType || 'task'}): ${task.statement}`;
    }
    if ('source' in item && item.source === 'policy_reports') {
      const doc = item as RetrievedDocument;
      return `Policy report "${doc.title || doc.documentId}" #${doc.chunkIndex}: ${doc.text.slice(0, 400)}`;
    }
    const doc = item as RetrievedDocument;
    return `Training program "${doc.title || doc.documentId}" #${doc.chunkIndex}: ${doc.text.slice(0, 400)}`;
  }
}
