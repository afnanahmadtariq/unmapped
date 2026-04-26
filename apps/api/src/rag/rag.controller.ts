import { Body, Controller, Post } from '@nestjs/common';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { RetrievalService } from './retrieval.service';
import { RagService, type ExtractCorpus } from './rag.service';

const SUPPORTED_CORPORA: ExtractCorpus[] = [
  'esco',
  'onet',
  'policy_reports',
  'training_programs',
];

class RetrieveSkillsDto {
  @IsString()
  story!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  declaredSkills?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  topK?: number;
}

class ExplainDto {
  @IsString()
  question!: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  iscoCode?: string;

  @IsOptional()
  @IsArray()
  @IsIn(SUPPORTED_CORPORA, { each: true })
  corpora?: ExtractCorpus[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;
}

@Controller('rag')
export class RagController {
  constructor(
    private readonly retrieval: RetrievalService,
    private readonly rag: RagService,
  ) {}

  /**
   * POST /rag/retrieve-skills
   * Demo / sanity endpoint. Production callers (profile/extract) use the
   * RagService directly via DI rather than HTTP.
   */
  @Post('retrieve-skills')
  retrieveSkills(@Body() body: RetrieveSkillsDto) {
    return this.retrieval.retrieveSkillsForStory(
      body.story,
      body.declaredSkills ?? [],
      body.topK ?? 12,
    );
  }

  /**
   * POST /rag/explain
   * Narrative-layer endpoint. Pulls cross-corpus evidence (ESCO + O*NET
   * + policy reports + training programs) and asks Claude for a
   * citation-grounded paragraph. Used by dashboard "explain this signal"
   * affordances and by the policymaker view.
   */
  @Post('explain')
  explain(@Body() body: ExplainDto) {
    return this.rag.explain({
      question: body.question,
      countryCode: body.countryCode,
      iscoCode: body.iscoCode ?? null,
      corpora: body.corpora,
      topK: body.topK,
    });
  }
}
