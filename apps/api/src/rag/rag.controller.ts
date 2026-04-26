import { Body, Controller, Post } from '@nestjs/common';
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { RetrievalService } from './retrieval.service';

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

@Controller('rag')
export class RagController {
  constructor(private readonly retrieval: RetrievalService) {}

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
}
