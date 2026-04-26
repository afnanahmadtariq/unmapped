// scripts/translate-locales.mjs
// Reads locales/en.json and produces translated copies into locales/<code>.json
// using Anthropic Claude. Idempotent: skips files that already exist unless
// --force is passed. Run from project root: node scripts/translate-locales.mjs [--force]

import { readFile, writeFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const TARGETS = [
  { code: "es", name: "Spanish (Latin American, neutral)" },
  { code: "ar", name: "Arabic (Modern Standard)" },
  { code: "hi", name: "Hindi" },
  { code: "pt", name: "Portuguese (Brazilian)" },
  { code: "zh", name: "Chinese (Simplified)" },
  { code: "sw", name: "Swahili" },
  { code: "ur", name: "Urdu" },
  { code: "de", name: "German" },
  { code: "id", name: "Indonesian (Bahasa Indonesia)" },
  { code: "ru", name: "Russian" },
  { code: "tr", name: "Turkish" },
  { code: "vi", name: "Vietnamese" },
];

const FORCE = process.argv.includes("--force");

const SYSTEM = `You are a careful UI translator for the UNMAPPED prototype, an open skills infrastructure for low- and middle-income countries.

Rules:
- Preserve the JSON structure EXACTLY. Same keys. Same nesting. Same types.
- Only translate string VALUES. Do NOT translate keys.
- Preserve {placeholder} tokens VERBATIM.
- Preserve product names VERBATIM: UNMAPPED, Hack-Nation, World Bank, ESCO, ISCO, ILOSTAT, WDI, ILO, OECD, LMIC, Frey-Osborne, Wittgenstein Centre, BTEB, NVTI, BECE, JSC, WASSCE, SSC, HSC, KCSE, Tavily, ICT, BPO, TVET, GDP, USD, JSON, PDF, CSV, AI.
- Use neutral, professional register suitable for governments, NGOs and youth users.
- Output ONLY the JSON. No commentary, no Markdown fence.`;

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function translateOne(client, target, sourceJson) {
  const userMessage = [
    `Translate the following UI dictionary from English into ${target.name} (locale code: ${target.code}).`,
    "",
    "JSON to translate:",
    "```json",
    JSON.stringify(sourceJson, null, 2),
    "```",
  ].join("\n");

  const res = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8192,
    system: SYSTEM,
    messages: [{ role: "user", content: userMessage }],
  });
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  // Strip optional code fences
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(stripped);
  } catch (e) {
    console.error(`! ${target.code}: model returned invalid JSON. First 200 chars:\n${stripped.slice(0, 200)}`);
    throw e;
  }
  return parsed;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set. Source .env.local first.");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const enPath = resolve(ROOT, "locales/en.json");
  const enJson = JSON.parse(await readFile(enPath, "utf8"));

  for (const target of TARGETS) {
    const outPath = resolve(ROOT, `locales/${target.code}.json`);
    if (!FORCE && (await exists(outPath))) {
      console.log(`= ${target.code}: exists, skipping (use --force to overwrite)`);
      continue;
    }
    process.stdout.write(`> ${target.code} (${target.name})... `);
    try {
      const translated = await translateOne(client, target, enJson);
      await writeFile(outPath, JSON.stringify(translated, null, 2) + "\n", "utf8");
      console.log("ok");
    } catch (e) {
      console.error("FAILED:", e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
