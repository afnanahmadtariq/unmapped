import { z } from 'zod';

/**
 * Single source of truth for every environment variable the API touches.
 * Validated once at boot in EnvService — fail fast on misconfiguration.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),

  // Postgres (required) — used by TypeORM
  POSTGRES_URL: z.string().url(),

  // Milvus / Zilliz (required for vector ops; ESCO ingest + RAG retrieval)
  MILVUS_URI: z.string().url(),
  MILVUS_TOKEN: z.string().min(1).optional(),
  MILVUS_DATABASE: z.string().default('default'),

  // Anthropic (required for skill extraction + opportunity generation)
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-5'),

  // Embeddings — Voyage by default (Anthropic-recommended); pluggable.
  EMBEDDINGS_PROVIDER: z.enum(['voyage', 'openai', 'cohere']).default('voyage'),
  EMBEDDINGS_API_KEY: z.string().optional(),
  EMBEDDINGS_MODEL: z.string().default('voyage-3'),
  EMBEDDINGS_DIM: z.coerce.number().int().positive().default(1024),

  // Tavily (optional — find-jobs degrades gracefully if missing)
  TAVILY_API_KEY: z.string().optional(),

  // SMTP (optional — email-link falls back to mailto: if missing)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),

  // Database controls — never auto-sync in production; opt-in for dev.
  TYPEORM_SYNC: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  TYPEORM_LOGGING: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type EnvConfig = z.infer<typeof envSchema>;
