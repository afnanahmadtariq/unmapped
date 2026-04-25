// UNMAPPED - Anthropic client wrapper.
// The model has TWO tools:
//   1) save_skills_profile - finalises the profile when input is sufficient
//   2) ask_clarifying_questions - returns 1-3 close-ended multiple-choice questions
//      when the user's data is conflicting or insufficient
// The route handler runs a multi-turn loop (capped at 2 clarification rounds).

import Anthropic from "@anthropic-ai/sdk";
import type {
  CountryCode,
  Demographics,
  SkillsProfile,
  SkillEvidence,
} from "@/types";
import escoData from "@/public/data/esco-skills.json";

const MODEL = "claude-sonnet-4-5";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    throw new Error("ANTHROPIC_API_KEY missing - set it in .env.local");
  _client = new Anthropic({ apiKey });
  return _client;
}

const ESCO_LIST = escoData.skills
  .map((s) => `${s.code}: ${s.label} (${s.category})`)
  .join("\n");

const SAVE_TOOL = {
  name: "save_skills_profile",
  description:
    "Save the final skills profile when you have enough information. Each skill must be grounded in the user's input.",
  input_schema: {
    type: "object" as const,
    properties: {
      skills: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const },
            escoCode: {
              type: "string" as const,
              description:
                "ESCO code from the provided taxonomy (e.g. S1.0.1). Must match an entry exactly.",
            },
            level: { type: "string" as const, enum: ["beginner", "intermediate", "advanced"] },
            evidence: {
              type: "string" as const,
              description:
                "One short plain-English sentence quoting or paraphrasing the user's input that justifies this skill.",
            },
            durabilityNote: {
              type: "string" as const,
              description:
                "Optional: one short sentence on whether this skill is automation-resilient or what adjacent skill would increase resilience.",
            },
          },
          required: ["name", "escoCode", "level", "evidence"],
        },
      },
    },
    required: ["skills"],
  },
};

const ASK_TOOL = {
  name: "ask_clarifying_questions",
  description:
    "Ask the user 1-3 close-ended multiple-choice questions ONLY when their input is conflicting (e.g. claims expert coding but lists no specific languages or tools), too thin to map confidently (e.g. < 2 evidenceable skills), or genuinely ambiguous about level. Each question must be answerable in one click.",
  input_schema: {
    type: "object" as const,
    properties: {
      reason: {
        type: "string" as const,
        description:
          "One sentence on why you cannot finalise yet. Examples: 'Story mentions coding but does not say which language', 'Two contradictory level signals'.",
      },
      questions: {
        type: "array" as const,
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object" as const,
          properties: {
            id: { type: "string" as const, description: "Short stable id, e.g. 'language' or 'level'." },
            prompt: { type: "string" as const, description: "The question text shown to the user." },
            options: {
              type: "array" as const,
              minItems: 2,
              maxItems: 6,
              items: {
                type: "object" as const,
                properties: {
                  value: { type: "string" as const },
                  label: { type: "string" as const },
                },
                required: ["value", "label"],
              },
            },
            allowOther: { type: "boolean" as const, description: "Allow a free-text 'other' answer." },
          },
          required: ["id", "prompt", "options"],
        },
      },
    },
    required: ["reason", "questions"],
  },
};

export interface ExtractInput {
  countryCode: CountryCode;
  educationLevel: string;
  languages: string[];
  yearsExperience: number;
  story: string;
  declaredSkills: string[];
  demographics?: Demographics;
}

export interface ClarifyingQuestion {
  id: string;
  prompt: string;
  options: Array<{ value: string; label: string }>;
  allowOther?: boolean;
}

export interface QAExchange {
  questions: ClarifyingQuestion[];
  reason: string;
  answers: Record<string, string>;
}

export type ExtractTurnResult =
  | { kind: "profile"; profile: SkillsProfile }
  | { kind: "clarify"; reason: string; questions: ClarifyingQuestion[] };

const SYSTEM_PROMPT = `You are the skills-mapping engine for UNMAPPED, an open infrastructure layer that translates a young person's real (often informal) experience into ESCO skill codes.

Be honest. If the user input is too thin to map confidently, or two signals conflict (e.g. they claim "expert" but the story has no concrete evidence), call ask_clarifying_questions instead of guessing. Each clarification must be a close-ended multiple-choice question answerable in one click - not free text. Limit to 3 questions per round.

When you have enough evidence, call save_skills_profile with 4-8 skills. Every skill must:
- be a code from the provided ESCO list (exact match)
- include one-sentence evidence quoting or paraphrasing the user's input
- have a calibrated level (beginner / intermediate / advanced)

Skip skills you cannot justify. Better to return fewer high-confidence skills than to invent.`;

function userTurn(input: ExtractInput): string {
  const demoLines = input.demographics
    ? [
        input.demographics.ageRange ? `Age range: ${input.demographics.ageRange}` : null,
        input.demographics.gender ? `Gender: ${input.demographics.gender}` : null,
        input.demographics.location ? `Location: ${input.demographics.location}` : null,
        input.demographics.workMode ? `Current work mode: ${input.demographics.workMode}` : null,
      ].filter(Boolean) as string[]
    : [];
  return [
    `Country context: ${input.countryCode}`,
    `Education level: ${input.educationLevel}`,
    `Languages: ${input.languages.join(", ") || "(none stated)"}`,
    `Years of experience (formal or informal): ${input.yearsExperience}`,
    ...demoLines,
    `User's own description: """${input.story}"""`,
    `Declared specific skills: ${input.declaredSkills.join(", ") || "(none)"}`,
    "",
    "Available ESCO skill codes (you MUST pick from this list - do not invent codes):",
    ESCO_LIST,
  ].join("\n");
}

function clarificationFollowup(answers: Record<string, string>, originalInput: ExtractInput): string {
  const lines = Object.entries(answers).map(([id, ans]) => `- ${id}: ${ans}`);
  return [
    "Here are the user's answers to your clarifying questions:",
    ...lines,
    "",
    "Now produce the final profile by calling save_skills_profile. If you still genuinely cannot, you may ask ONE more round of clarification (max 1).",
    "",
    "Reminder of original input:",
    userTurn(originalInput),
  ].join("\n");
}

const validCodes = new Set(escoData.skills.map((s) => s.code));

function buildProfile(
  input: ExtractInput,
  rawSkills: SkillEvidence[]
): SkillsProfile {
  const cleanSkills = rawSkills.filter((s) => validCodes.has(s.escoCode));
  return {
    userInputSummary: input.story.slice(0, 200),
    countryCode: input.countryCode,
    educationLevel: input.educationLevel,
    languages: input.languages,
    yearsExperience: input.yearsExperience,
    demographics: input.demographics,
    skills: cleanSkills,
    generatedAt: new Date().toISOString(),
  };
}

/** Single turn against the model, given the conversation history. */
async function runTurn(
  messages: Anthropic.Messages.MessageParam[]
): Promise<{ stop: Anthropic.Messages.Message }> {
  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    tools: [SAVE_TOOL, ASK_TOOL],
    tool_choice: { type: "any" },
    messages,
  });
  return { stop: response };
}

/** Initial extraction (turn 1). Returns either a profile or clarifying questions. */
export async function extractInitial(input: ExtractInput): Promise<{
  result: ExtractTurnResult;
  history: Anthropic.Messages.MessageParam[];
}> {
  const history: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userTurn(input) },
  ];
  const { stop } = await runTurn(history);
  history.push({ role: "assistant", content: stop.content });

  const toolUse = stop.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use")
    throw new Error("Model did not use a tool");

  if (toolUse.name === ASK_TOOL.name) {
    const t = toolUse.input as { reason: string; questions: ClarifyingQuestion[] };
    return {
      result: { kind: "clarify", reason: t.reason, questions: t.questions },
      history,
    };
  }

  const t = toolUse.input as { skills: SkillEvidence[] };
  return {
    result: { kind: "profile", profile: buildProfile(input, t.skills) },
    history,
  };
}

/** Follow-up turn after the user has answered the clarifying questions. */
export async function continueWithAnswers(
  input: ExtractInput,
  history: Anthropic.Messages.MessageParam[],
  lastAssistant: Anthropic.Messages.Message["content"],
  answers: Record<string, string>
): Promise<ExtractTurnResult> {
  // Build tool_result for each ask tool block
  const toolUseBlock = lastAssistant.find((b) => b.type === "tool_use");
  if (!toolUseBlock || toolUseBlock.type !== "tool_use")
    throw new Error("No tool_use in last turn");

  const toolResultMessage: Anthropic.Messages.MessageParam = {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: toolUseBlock.id,
        content: JSON.stringify(answers),
      },
      { type: "text", text: clarificationFollowup(answers, input) },
    ],
  };

  const next: Anthropic.Messages.MessageParam[] = [...history, toolResultMessage];
  const { stop } = await runTurn(next);

  const toolUse = stop.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use")
    throw new Error("Model did not use a tool on follow-up");

  if (toolUse.name === ASK_TOOL.name) {
    const t = toolUse.input as { reason: string; questions: ClarifyingQuestion[] };
    return { kind: "clarify", reason: t.reason, questions: t.questions };
  }

  const t = toolUse.input as { skills: SkillEvidence[] };
  return { kind: "profile", profile: buildProfile(input, t.skills) };
}
