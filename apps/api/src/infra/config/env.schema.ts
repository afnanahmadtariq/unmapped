import { z } from 'zod';

/**
 * Single source of truth for every environment variable the API touches.
 * Validated once at boot in EnvService — fail fast on misconfiguration.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),

  // Postgres (required) — used by TypeORM
  POSTGRES_URL: z.string().url(),

  // Milvus / Zilliz (required for vector ops; ESCO ingest + RAG retrieval)
  MILVUS_URI: z.string().url(),
  // Zilliz/Milvus SDK: pass API key, or db user credentials as "user:password".
  // If empty, MILVUS_USER + MILVUS_PASSWORD are combined to that form.
  MILVUS_TOKEN: z.string().optional(),
  MILVUS_USER: z.string().optional(),
  MILVUS_PASSWORD: z.string().optional(),
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

  // Admin (single-user, env-driven). Hashes are bcrypt; secret signs short-lived JWT.
  // The hash + plaintext are dev-friendly: provide a hash in production, plaintext only for local.
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  ADMIN_JWT_SECRET: z.string().min(16).optional(),
  ADMIN_JWT_TTL_HOURS: z.coerce.number().int().positive().default(12),

  // Optional end-user accounts. Sign-up is allowed when `USER_AUTH_ENABLED`
  // is true AND `USER_JWT_SECRET` is set. Sessions live in the
  // `cartographer_user_session` cookie (separate from the admin one).
  USER_AUTH_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  USER_JWT_SECRET: z.string().min(16).optional(),
  USER_JWT_TTL_HOURS: z.coerce.number().int().positive().default(168),
  USER_SIGNUP_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // Database controls — never auto-sync in production; opt-in for dev.
  TYPEORM_SYNC: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  TYPEORM_LOGGING: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Startup harvest — when true, the API kicks off a sequential refresh of
  // every registered harvester shortly after boot. Sources with a successful
  // run younger than HARVEST_STARTUP_FRESHNESS_HOURS are skipped, so this is
  // idempotent across restarts.
  HARVEST_ON_STARTUP: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  HARVEST_STARTUP_DELAY_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(5_000),
  HARVEST_STARTUP_FRESHNESS_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(24),
});

export type EnvConfig = z.infer<typeof envSchema>;
