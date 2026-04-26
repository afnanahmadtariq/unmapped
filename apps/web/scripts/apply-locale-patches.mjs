/**
 * Merge apps/web/scripts/locale-patches.json into apps/web/locales/<code>.json
 * Run from repo root: node apps/web/scripts/apply-locale-patches.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const patchesPath = path.join(__dirname, "locale-patches.json");
const patches = JSON.parse(fs.readFileSync(patchesPath, "utf8"));
const localesDir = path.join(__dirname, "..", "locales");

for (const [code, sections] of Object.entries(patches)) {
  const filePath = path.join(localesDir, `${code}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn("skip missing locale file:", code);
    continue;
  }
  const j = JSON.parse(fs.readFileSync(filePath, "utf8"));
  for (const [sec, keys] of Object.entries(sections)) {
    if (typeof keys !== "object" || keys === null) continue;
    if (!j[sec]) j[sec] = {};
    Object.assign(j[sec], keys);
  }
  fs.writeFileSync(filePath, JSON.stringify(j, null, 2) + "\n");
  console.log("patched", code);
}
