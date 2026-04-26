import { readFile, writeFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";

const NEW_KEYS = [
  "saveLink", "shareLink", "linkCopied", "linkCopiedBody",
  "linkCopyFailed", "loadedFromLinkTitle", "loadedFromLinkBody"
];
const TARGETS = [
  ["fr", "French"],
  ["es", "Spanish (LatAm neutral)"],
  ["pt", "Portuguese (Brazilian)"],
  ["de", "German"],
  ["ru", "Russian"],
  ["tr", "Turkish"],
  ["id", "Indonesian"],
  ["vi", "Vietnamese"],
  ["zh", "Chinese (Simplified)"],
  ["hi", "Hindi"],
  ["bn", "Bangla"],
  ["sw", "Swahili"],
  ["ar", "Arabic (Modern Standard)"],
  ["ur", "Urdu"],
];

const en = JSON.parse(await readFile("locales/en.json", "utf8"));
const subset = Object.fromEntries(NEW_KEYS.map(k => [k, en.profile[k]]));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

for (const [code, langName] of TARGETS) {
  process.stdout.write(`> ${code}... `);
  const path = `locales/${code}.json`;
  const dict = JSON.parse(await readFile(path, "utf8"));
  if (NEW_KEYS.every(k => dict.profile[k])) { console.log("already has all keys, skip"); continue; }

  const res = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    system: `Translate UI strings into ${langName}. Preserve {placeholder} tokens. Output ONLY a JSON object with the exact same keys as input. No commentary, no fence.`,
    messages: [{ role: "user", content: `Translate these strings into ${langName}:\n\n${JSON.stringify(subset, null, 2)}` }]
  });
  const txt = res.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
  const stripped = txt.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const translated = JSON.parse(stripped);
  for (const k of NEW_KEYS) dict.profile[k] = translated[k] ?? en.profile[k];
  await writeFile(path, JSON.stringify(dict, null, 2) + "\n", "utf8");
  console.log("ok");
}
