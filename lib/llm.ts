// UNMAPPED - Anthropic client wrapper with structured output for skills extraction.
// Uses tool-use to force well-formed JSON instead of free-text parsing.

import Anthropic from "@anthropic-ai/sdk";
import type { CountryCode, Demographics, SkillsProfile } from "@/types";
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

const TOOL = {
  name: "save_skills_profile",
  description:
    "Save the user's skills profile mapped to ESCO codes. Always include plain-English evidence for each skill so the user can understand and own their profile.",
  input_schema: {
    type: "object" as const,
    properties: {
      skills: {
        type: "array" as const,
        description: "List of skills mapped to ESCO codes",
        items: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const, description: "Human-readable skill name in the user's words" },
            escoCode: {
              type: "string" as const,
              description:
                "ESCO code from the provided taxonomy (e.g. S1.0.1). Must match an entry in the provided list exactly.",
            },
            level: {
              type: "string" as const,
              enum: ["beginner", "intermediate", "advanced"],
            },
            evidence: {
              type: "string" as const,
              description:
                "One short plain-English sentence quoting or paraphrasing the user's input that justifies this skill - Amara should be able to read this and recognise herself.",
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

export interface ExtractInput {
  countryCode: CountryCode;
  educationLevel: string;
  languages: string[];
  yearsExperience: number;
  story: string;
  declaredSkills: string[];
  demographics?: Demographics;
}

export async function extractSkillsProfile(
  input: ExtractInput
): Promise<SkillsProfile> {
  const demoLines = input.demographics
    ? [
        input.demographics.ageRange ? `Age range: ${input.demographics.ageRange}` : null,
        input.demographics.gender ? `Gender: ${input.demographics.gender}` : null,
        input.demographics.location ? `Location: ${input.demographics.location}` : null,
        input.demographics.workMode ? `Current work mode: ${input.demographics.workMode}` : null,
      ].filter(Boolean) as string[]
    : [];

  const userMessage = [
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
    "",
    "Extract 4-8 skills that are clearly evidenced by the user's input. Use the demographic + work-mode context to calibrate skill levels (e.g. self-employed informal traders may have stronger sales/management skills than formally classified). Skip skills you cannot justify from the input. Always quote or paraphrase the input in the evidence field.",
  ].join("\n");

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 1500,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use")
    throw new Error("Model did not return a tool_use block");

  const parsed = toolUse.input as { skills: SkillsProfile["skills"] };

  // Defensive: drop any skill whose escoCode is not in our taxonomy
  const validCodes = new Set(escoData.skills.map((s) => s.code));
  const cleanSkills = parsed.skills.filter((s) => validCodes.has(s.escoCode));

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
