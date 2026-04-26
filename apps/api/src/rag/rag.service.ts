import { Injectable } from '@nestjs/common';
import { RetrievalService, RetrievedSkill } from './retrieval.service';

export interface ExtractRetrievalContext {
  /** Compact one-line list, ready to inline into a Claude system prompt. */
  inlineList: string;
  /** Full structured rows for downstream callers (e.g. matcher pre-filter). */
  rows: RetrievedSkill[];
}

/**
 * Orchestrates retrieval for downstream LLM calls. The contract is:
 *   - "buildExtractContext" returns a slimmed ESCO skill list relevant to
 *     the user story + declared skills, replacing the static ESCO_LIST that
 *     used to be crammed into the prompt in `apps/web/lib/llm.ts`.
 *   - "explainOccupation" is a stub for the future narrative endpoint that
 *     joins task/skill descriptions and asks Claude for a paragraph.
 */
@Injectable()
export class RagService {
  constructor(private readonly retrieval: RetrievalService) {}

  async buildExtractContext(input: {
    story: string;
    declaredSkills?: string[];
    k?: number;
  }): Promise<ExtractRetrievalContext> {
    const rows = await this.retrieval.retrieveSkillsForStory(
      input.story ?? '',
      input.declaredSkills ?? [],
      input.k ?? 24,
    );
    const inlineList = rows
      .map(
        (r) =>
          `${r.code} | ${r.label} | ${r.category} | ISCO: [${r.iscoLinks.join(', ')}]`,
      )
      .join('\n');
    return { inlineList, rows };
  }
}
