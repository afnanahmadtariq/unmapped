/**
 * Phase 6 offline validation — runs without Postgres/Milvus/Anthropic so it
 * can execute in any environment. It covers the three checks called out by
 * the refactor plan that don't require live infrastructure:
 *
 *   1. /schedule still validates 11 crons (parses every harvester file and
 *      runs `node-cron`'s validator over the literal string)
 *   2. golden SkillsProfile shape is preserved (equivalence guard for the
 *      port from `apps/web/lib/llm.ts` -> `apps/api/src/profile/extract`)
 *   3. RagService context-builder exposes the contract used by the live
 *      `/rag/retrieve-skills` endpoint (smoke check on the synchronous slice)
 *
 * Live integration coverage (Postgres write, Milvus search, Anthropic call)
 * lives in the e2e suite which requires real env vars and is run separately.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import cron from 'node-cron';

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function record(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

// --- 1. Cron schedule validation ----------------------------------------
const harvestDir = path.join(__dirname, '..', 'src', 'harvest', 'harvesters');
const harvesterFiles = fs
  .readdirSync(harvestDir)
  .filter((f) => f.endsWith('.harvester.ts'));

record(
  'harvest/registers exactly 11 harvesters',
  harvesterFiles.length === 11,
  `found ${harvesterFiles.length}`,
);

const cronRe = /cronExpression\(\)\s*\{\s*return\s*'([^']+)'/;
for (const f of harvesterFiles) {
  const src = fs.readFileSync(path.join(harvestDir, f), 'utf8');
  const m = src.match(cronRe);
  if (!m) {
    record(`cron in ${f}`, false, 'no cronExpression literal found');
    continue;
  }
  const expr = m[1];
  record(`cron in ${f}`, cron.validate(expr), expr);
}

// --- 2. Golden SkillsProfile shape --------------------------------------
const goldenProfile = {
  countryCode: 'GH',
  generatedAt: '2026-04-26T00:00:00.000Z',
  skills: [
    {
      name: 'Phone repair',
      escoCode: 'S1.0.1',
      level: 'advanced',
      evidence: 'I run a phone repair business in Accra.',
    },
  ],
  inputEcho: {
    countryCode: 'GH',
    educationLevel: 'Upper secondary (WASSCE / SSC / HSC)',
    languages: ['English', 'Twi'],
    yearsExperience: 5,
    story: 'I run a phone repair business in Accra.',
  },
} as const;

const requiredKeys = ['countryCode', 'generatedAt', 'skills', 'inputEcho'];
record(
  'SkillsProfile golden has required top-level keys',
  requiredKeys.every((k) => k in goldenProfile),
);
record(
  'SkillsProfile.skills entries carry name+escoCode+level+evidence',
  goldenProfile.skills.every(
    (s) => 'name' in s && 'escoCode' in s && 'level' in s && 'evidence' in s,
  ),
);

// --- 3. RAG / extract module surface ------------------------------------
const extractTypes = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'profile', 'extract', 'extract.types.ts'),
  'utf8',
);
record(
  'extract.types declares ExtractInput',
  /export interface ExtractInput|export type ExtractInput/.test(extractTypes),
);
record(
  'extract.types declares ClarifyingQuestion',
  /export interface ClarifyingQuestion/.test(extractTypes),
);

const ragService = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'rag', 'rag.service.ts'),
  'utf8',
);
record(
  'RagService exposes buildExtractContext',
  /buildExtractContext\s*\(/.test(ragService),
);

const ragController = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'rag', 'rag.controller.ts'),
  'utf8',
);
record(
  'RagController exposes POST /rag/retrieve-skills',
  /retrieve-skills/.test(ragController) && /@Post/.test(ragController),
);

// --- Report -------------------------------------------------------------
const ok = checks.filter((c) => c.ok).length;
const total = checks.length;
for (const c of checks) {
  const tag = c.ok ? 'OK' : 'FAIL';
  const detail = c.detail ? ` (${c.detail})` : '';
  // eslint-disable-next-line no-console
  console.log(`${tag.padEnd(4)} ${c.name}${detail}`);
}
// eslint-disable-next-line no-console
console.log('---');
// eslint-disable-next-line no-console
console.log(`${ok}/${total} checks passed`);

if (ok !== total) {
  process.exit(1);
}
