import type Anthropic from '@anthropic-ai/sdk';

export const SAVE_TOOL: Anthropic.Messages.Tool = {
  name: 'save_skills_profile',
  description:
    "Save the final skills profile when you have enough information. Each skill must be grounded in the user's input.",
  input_schema: {
    type: 'object',
    properties: {
      skills: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            escoCode: {
              type: 'string',
              description:
                'ESCO code from the provided taxonomy (e.g. S1.0.1). Must match an entry exactly.',
            },
            level: {
              type: 'string',
              enum: ['beginner', 'intermediate', 'advanced'],
            },
            evidence: {
              type: 'string',
              description:
                "One short plain-English sentence quoting or paraphrasing the user's input that justifies this skill.",
            },
            durabilityNote: {
              type: 'string',
              description:
                'Optional: one short sentence on whether this skill is automation-resilient or what adjacent skill would increase resilience.',
            },
          },
          required: ['name', 'escoCode', 'level', 'evidence'],
        },
      },
    },
    required: ['skills'],
  },
};

export const ASK_TOOL: Anthropic.Messages.Tool = {
  name: 'ask_clarifying_questions',
  description:
    "Ask the user 1-3 close-ended multiple-choice questions ONLY when their input is conflicting (e.g. claims expert coding but lists no specific languages or tools), too thin to map confidently (e.g. < 2 evidenceable skills), or genuinely ambiguous about level. Each question must be answerable in one click.",
  input_schema: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description:
          "One sentence on why you cannot finalise yet. Examples: 'Story mentions coding but does not say which language', 'Two contradictory level signals'.",
      },
      questions: {
        type: 'array',
        minItems: 1,
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: "Short stable id, e.g. 'language' or 'level'.",
            },
            prompt: {
              type: 'string',
              description: 'The question text shown to the user.',
            },
            options: {
              type: 'array',
              minItems: 2,
              maxItems: 6,
              items: {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                  label: { type: 'string' },
                },
                required: ['value', 'label'],
              },
            },
            allowOther: {
              type: 'boolean',
              description: "Allow a free-text 'other' answer.",
            },
          },
          required: ['id', 'prompt', 'options'],
        },
      },
    },
    required: ['reason', 'questions'],
  },
};
