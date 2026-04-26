// UNMAPPED - encode/decode a SkillsProfile into a URL hash.
// Pattern: /opportunities?country=PK#p=<base64url(json)>
// The URL itself IS the profile. No backend, no auth, no PII server-side.

import type { SkillsProfile } from "@/types";

const HASH_KEY = "p";

/** Base64url-encode a UTF-8 JSON string. */
function b64urlEncode(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Build a fully-qualified URL with the profile encoded into the hash. */
export function buildProfileUrl(
  profile: SkillsProfile,
  pathname: string,
  searchParams?: URLSearchParams
): string {
  if (typeof window === "undefined") {
    throw new Error("buildProfileUrl can only run in the browser");
  }
  const json = JSON.stringify(profile);
  const enc = b64urlEncode(json);
  const sp = searchParams ? `?${searchParams.toString()}` : "";
  return `${window.location.origin}${pathname}${sp}#${HASH_KEY}=${enc}`;
}

/** Read the hash on the current location and try to decode a profile. */
export function readProfileFromHash(): SkillsProfile | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const enc = params.get(HASH_KEY);
  if (!enc) return null;
  try {
    const json = b64urlDecode(enc);
    const parsed = JSON.parse(json) as SkillsProfile;
    if (!parsed.skills || !Array.isArray(parsed.skills)) return null;
    if (!parsed.countryCode) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Best-effort copy to clipboard. Returns true on success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Best-effort native share. Returns true if the share sheet opened. */
export async function nativeShare(text: string, title: string, url: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  // Web Share API only exists on https or localhost
  const nav = navigator as Navigator & {
    share?: (data: { title: string; text: string; url: string }) => Promise<void>;
  };
  if (typeof nav.share !== "function") return false;
  try {
    await nav.share({ title, text, url });
    return true;
  } catch {
    return false;
  }
}
