import { Body, Controller, Post } from '@nestjs/common';
import { ExtractService } from './extract.service';
import { ExtractFollowUpDto, ExtractInitialDto } from './extract.dto';
import {
  AnthropicAssistantContent,
  AnthropicHistory,
  ExtractFollowUpResponse,
  ExtractInitialResponse,
  ExtractInput,
} from './extract.types';

@Controller('profile/extract')
export class ExtractController {
  constructor(private readonly extract: ExtractService) {}

  /**
   * POST /profile/extract
   * Initial turn. Same payload shape as the legacy Next.js
   * /api/extract-skills route (sans the `phase` discriminator).
   */
  @Post()
  async initial(
    @Body() body: ExtractInitialDto,
  ): Promise<ExtractInitialResponse> {
    const baseInput = body as ExtractInput;
    const { result, history } = await this.extract.extractInitial(baseInput);
    return { result, history, baseInput };
  }

  /**
   * POST /profile/extract/follow-up
   * Continuation after the user has answered clarifying questions.
   */
  @Post('follow-up')
  async followUp(
    @Body() body: ExtractFollowUpDto,
  ): Promise<ExtractFollowUpResponse> {
    const baseInput = body.baseInput as ExtractInput;
    const result = await this.extract.continueWithAnswers(
      baseInput,
      body.history as AnthropicHistory,
      body.lastAssistant as AnthropicAssistantContent,
      body.answers,
    );
    return { result, baseInput };
  }
}
