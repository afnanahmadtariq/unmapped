import type { ExtractInput } from './extract.types';

export const EXTRACT_SYSTEM_PROMPT = `You are the skills-mapping engine for UNMAPPED, an open infrastructure layer that translates a young person's real (often informal) experience into ESCO skill codes.

Be honest. If the user input is too thin to map confidently, or two signals conflict (e.g. they claim "expert" but the story has no concrete evidence), call ask_clarifying_questions instead of guessing. Each clarification must be a close-ended multiple-choice question answerable in one click - not free text. Limit to 3 questions per round.

When you have enough evidence, call save_skills_profile with 4-8 skills. Every skill must:
- be a code from the provided ESCO list (exact match)
- include one-sentence evidence quoting or paraphrasing the user's input
- have a calibrated level (beginner / intermediate / advanced)

Skip skills you cannot justify. Better to return fewer high-confidence skills than to invent.`;

/**
 * Build the user-turn message. Identical wording to the original
 * `apps/web/lib/llm.ts:userTurn` so output equivalence is preserved.
 * The only structural change: the ESCO list is no longer the entire
 * taxonomy — it is the RAG retrieval result for this story.
 */
export function buildUserTurn(input: ExtractInput, escoList: string): string {
  const demoLines = input.demographics
    ? ([
        input.demographics.ageRange ? `Age range: ${input.demographics.ageRange}` : null,
        input.demographics.gender ? `Gender: ${input.demographics.gender}` : null,
        input.demographics.location ? `Location: ${input.demographics.location}` : null,
        input.demographics.workMode ? `Current work mode: ${input.demographics.workMode}` : null,
      ].filter(Boolean) as string[])
    : [];

  const ctx = input.context;
  const contextLines: string[] = [];
  if (ctx) {
    if (ctx.phoneAccess) contextLines.push(`Phone access: ${ctx.phoneAccess}`);
    if (ctx.selfLearning?.length)
      contextLines.push(`Self-learning channels: ${ctx.selfLearning.join(', ')}`);
    if (ctx.workEntries?.length) {
      contextLines.push('Real-world work history:');
      for (const w of ctx.workEntries) {
        contextLines.push(
          `  - ${w.activity}: ${w.years}y, ${w.frequency}, ${w.paid ? 'paid' : 'unpaid'}`,
        );
      }
    }
    if (ctx.tasks?.length) contextLines.push(`Tasks performed: ${ctx.tasks.join(', ')}`);
    if (ctx.tools?.length) contextLines.push(`Tools used: ${ctx.tools.join(', ')}`);
    if (ctx.constraints) {
      const c = ctx.constraints;
      const parts: string[] = [];
      if (c.maxTravelKm != null) parts.push(`travel ≤ ${c.maxTravelKm}km`);
      if (c.needIncomeNow) parts.push('needs income now');
      if (c.canStudy === false) parts.push('cannot study/train');
      if (c.canStudy === true) parts.push('can study/train');
      if (c.hasInternet === false) parts.push('no internet');
      if (c.hasInternet === true) parts.push('has internet');
      if (parts.length) contextLines.push(`Constraints: ${parts.join('; ')}`);
    }
    if (ctx.aspirations)
      contextLines.push(`Aspirations (soft signal): ${ctx.aspirations}`);
  }

  return [
    `Country context: ${input.countryCode}`,
    `Education level: ${input.educationLevel}`,
    `Languages: ${input.languages.join(', ') || '(none stated)'}`,
    `Years of experience (formal or informal): ${input.yearsExperience}`,
    ...demoLines,
    ...contextLines,
    `User's own description: """${input.story}"""`,
    `Declared specific skills: ${input.declaredSkills.join(', ') || '(none)'}`,
    '',
    'Available ESCO skill codes (you MUST pick from this list - do not invent codes):',
    escoList,
  ].join('\n');
}

export function buildClarificationFollowup(
  answers: Record<string, string>,
  originalInput: ExtractInput,
  escoList: string,
): string {
  const lines = Object.entries(answers).map(([id, ans]) => `- ${id}: ${ans}`);
  return [
    "Here are the user's answers to your clarifying questions:",
    ...lines,
    '',
    'Now produce the final profile by calling save_skills_profile. If you still genuinely cannot, you may ask ONE more round of clarification (max 1).',
    '',
    'Reminder of original input:',
    buildUserTurn(originalInput, escoList),
  ].join('\n');
}
