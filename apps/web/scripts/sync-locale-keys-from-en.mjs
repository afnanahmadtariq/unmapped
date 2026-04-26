/**
 * One-off sync: copy keys present in en.json but missing in other locale files
 * from English (keeps Dictionary shape aligned for TypeScript).
 * Run from repo root: node apps/web/scripts/sync-locale-keys-from-en.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "..", "locales");
const en = JSON.parse(fs.readFileSync(path.join(localesDir, "en.json"), "utf8"));

function deepFillMissing(target, source) {
  if (source === null || typeof source !== "object" || Array.isArray(source)) return;
  if (typeof target !== "object" || target === null || Array.isArray(target)) return;
  for (const k of Object.keys(source)) {
    if (!(k in target)) {
      target[k] = source[k];
      continue;
    }
    deepFillMissing(target[k], source[k]);
  }
}

for (const name of fs.readdirSync(localesDir)) {
  if (!name.endsWith(".json") || name === "en.json") continue;
  const p = path.join(localesDir, name);
  const loc = JSON.parse(fs.readFileSync(p, "utf8"));
  deepFillMissing(loc, en);
  fs.writeFileSync(p, JSON.stringify(loc, null, 2) + "\n");
  console.log("synced", name);
}
