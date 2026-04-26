import type Anthropic from '@anthropic-ai/sdk';
import type {
  CountryCode,
  Demographics,
  ProfileContext,
  SkillEvidence,
  SkillsProfile,
} from '../../shared/types';

export interface ExtractInput {
  countryCode: CountryCode;
  educationLevel: string;
  languages: string[];
  yearsExperience: number;
  story: string;
  declaredSkills: string[];
  demographics?: Demographics;
  context?: ProfileContext;
}

export interface ClarifyingQuestion {
  id: string;
  prompt: string;
  options: Array<{ value: string; label: string }>;
  allowOther?: boolean;
}

export type ExtractTurnResult =
  | { kind: 'profile'; profile: SkillsProfile }
  | { kind: 'clarify'; reason: string; questions: ClarifyingQuestion[] };

export type AnthropicHistory = Anthropic.Messages.MessageParam[];
export type AnthropicAssistantContent = Anthropic.Messages.Message['content'];

export interface ExtractInitialResponse {
  result: ExtractTurnResult;
  history: AnthropicHistory;
  baseInput: ExtractInput;
}

export interface ExtractFollowUpResponse {
  result: ExtractTurnResult;
  baseInput: ExtractInput;
}

export type { SkillEvidence };
