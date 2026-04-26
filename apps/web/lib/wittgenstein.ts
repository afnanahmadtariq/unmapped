// UNMAPPED - Wittgenstein Centre Human Capital Data Explorer wrapper.
// Data Explorer at https://dataexplorer.wittgensteincentre.org/wcde-v3/
// Public web service is heavy + variable; we ship a curated SSP2 snapshot for
// the demo. Live API integration is documented in the README.

import wittData from "@/public/data/wittgenstein.json";
import { getCountry } from "@/lib/config";
import type { CountryCode } from "@/types";

export type EducationBucket = "noEdu" | "primary" | "lowerSec" | "upperSec" | "tertiary";

export interface ProjectionPoint {
  year: 2025 | 2030 | 2035;
  shares: Record<EducationBucket, number>;
}

const BY_COUNTRY = wittData.byCountry as Record<
  string,
  Record<string, Record<EducationBucket, number>>
>;

export function getProjectionsForCountry(code: CountryCode): ProjectionPoint[] | null {
  const iso3 = getCountry(code).iso3;
  const block = BY_COUNTRY[iso3];
  if (!block) return null;
  return (["2025", "2030", "2035"] as const).map((y) => ({
    year: Number(y) as 2025 | 2030 | 2035,
    shares: block[y] as Record<EducationBucket, number>,
  }));
}

const BUCKET_LABEL: Record<EducationBucket, string> = {
  noEdu: "No formal",
  primary: "Primary",
  lowerSec: "Lower sec",
  upperSec: "Upper sec",
  tertiary: "Tertiary+",
};

export function bucketLabel(b: EducationBucket): string {
  return BUCKET_LABEL[b];
}

/** Map our user-input education label to the closest Wittgenstein bucket so we
 *  can compute "your relative position now vs in 2035". */
export function bucketFromEducationLabel(label: string): EducationBucket {
  const l = label.toLowerCase();
  if (l.includes("postgrad") || l.includes("bachelor") || l.includes("diploma")) return "tertiary";
  if (l.includes("upper") || l.includes("hsc") || l.includes("wassce") || l.includes("ssc")) return "upperSec";
  if (l.includes("lower") || l.includes("jsc") || l.includes("bece")) return "lowerSec";
  if (l.includes("vocational") || l.includes("tvet")) return "upperSec";
  if (l.includes("primary")) return "primary";
  return "noEdu";
}
