import { Injectable, Logger } from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';
import { AnthropicClient } from '../../infra/anthropic/anthropic.client';
import { RagService } from '../../rag/rag.service';
import { EscoService } from '../../taxonomies/esco/esco.service';
import {
  AnthropicAssistantContent,
  AnthropicHistory,
  ClarifyingQuestion,
  ExtractInput,
  ExtractTurnResult,
} from './extract.types';
import {
  EXTRACT_SYSTEM_PROMPT,
  buildClarificationFollowup,
  buildUserTurn,
} from './extract.prompt';
import { ASK_TOOL, SAVE_TOOL } from './extract.tools';
import type {
  SkillEvidence,
  SkillsProfile,
} from '../../shared/types';

/**
 * Port of apps/web/lib/llm.ts. The two-tool loop and prompt wording are
 * preserved 1:1 for output equivalence; the only structural change is
 * that the inline ESCO list is now produced by RagService.buildExtractContext
 * (vector retrieval over Milvus) instead of a hardcoded snapshot.
 */
@Injectable()
export class ExtractService {
  private readonly logger = new Logger(ExtractService.name);

  constructor(
    private readonly anthropic: AnthropicClient,
    private readonly rag: RagService,
    private readonly esco: EscoService,
  ) {}

  async extractInitial(
    input: ExtractInput,
  ): Promise<{ result: ExtractTurnResult; history: AnthropicHistory }> {
    const ctx = await this.rag.buildExtractContext({
      story: input.story,
      declaredSkills: input.declaredSkills,
    });
    const history: AnthropicHistory = [
      { role: 'user', content: buildUserTurn(input, ctx.inlineList) },
    ];
    const stop = await this.runTurn(history);
    history.push({ role: 'assistant', content: stop.content });
    return {
      result: await this.parseToolUse(stop.content, input),
      history,
    };
  }

  async continueWithAnswers(
    input: ExtractInput,
    history: AnthropicHistory,
    lastAssistant: AnthropicAssistantContent,
    answers: Record<string, string>,
  ): Promise<ExtractTurnResult> {
    const toolUseBlock = lastAssistant.find((b) => b.type === 'tool_use');
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use')
      throw new Error('No tool_use in last turn');

    const ctx = await this.rag.buildExtractContext({
      story: input.story,
      declaredSkills: input.declaredSkills,
    });
    const followupText = buildClarificationFollowup(
      answers,
      input,
      ctx.inlineList,
    );
    const next: AnthropicHistory = [
      ...history,
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: JSON.stringify(answers),
          },
          { type: 'text', text: followupText },
        ],
      },
    ];

    const stop = await this.runTurn(next);
    return this.parseToolUse(stop.content, input);
  }

  private async runTurn(
    messages: AnthropicHistory,
  ): Promise<Anthropic.Messages.Message> {
    return this.anthropic.raw().messages.create({
      model: this.anthropic.model,
      max_tokens: 1500,
      system: EXTRACT_SYSTEM_PROMPT,
      tools: [SAVE_TOOL, ASK_TOOL],
      tool_choice: { type: 'any' },
      messages,
    });
  }

  private async parseToolUse(
    content: AnthropicAssistantContent,
    input: ExtractInput,
  ): Promise<ExtractTurnResult> {
    const toolUse = content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use')
      throw new Error('Model did not use a tool');

    if (toolUse.name === ASK_TOOL.name) {
      const t = toolUse.input as {
        reason: string;
        questions: ClarifyingQuestion[];
      };
      return { kind: 'clarify', reason: t.reason, questions: t.questions };
    }
    const t = toolUse.input as { skills: SkillEvidence[] };
    const profile = await this.buildProfile(input, t.skills);
    return { kind: 'profile', profile };
  }

  private async buildProfile(
    input: ExtractInput,
    rawSkills: SkillEvidence[],
  ): Promise<SkillsProfile> {
    const validCodes = await this.esco.loadValidCodes();
    const cleanSkills = rawSkills.filter((s) => validCodes.has(s.escoCode));
    return {
      userInputSummary: input.story.slice(0, 200),
      countryCode: input.countryCode,
      educationLevel: input.educationLevel,
      languages: input.languages,
      yearsExperience: input.yearsExperience,
      demographics: input.demographics,
      context: input.context,
      skills: cleanSkills,
      generatedAt: new Date().toISOString(),
    };
  }
}
