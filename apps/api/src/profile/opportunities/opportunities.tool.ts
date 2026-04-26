import type Anthropic from '@anthropic-ai/sdk';

export const OPPORTUNITY_TOOL: Anthropic.Messages.Tool = {
  name: 'save_opportunity_pathways',
  description:
    'Save 4 reachable opportunity pathways for a young person - one of each type: formal employment, self-employment, gig work, training pathway. Be honest and grounded - no aspirational fluff.',
  input_schema: {
    type: 'object',
    properties: {
      opportunities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['formal', 'self-employment', 'gig', 'training'],
            },
            title: {
              type: 'string',
              description: 'Short, specific title (≤60 chars)',
            },
            source: {
              type: 'string',
              description:
                'Where this opportunity is found locally - name a real platform, ministry, NGO or category',
            },
            estimatedEarning: {
              type: 'string',
              description:
                "Realistic local-currency range, or 'free' for training",
            },
            timeToReadiness: {
              type: 'string',
              description:
                "Honest time estimate, e.g. 'apply this week', '3-month course'",
            },
            description: {
              type: 'string',
              description: 'One concrete sentence the user can act on',
            },
          },
          required: ['type', 'title', 'source', 'description'],
        },
      },
    },
    required: ['opportunities'],
  },
};
