import { NextResponse } from "next/server";
import { matchOccupations } from "@/lib/matcher";
import { computeResilience } from "@/lib/resilience";
import type { CountryCode, SkillsProfile } from "@/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      profile?: SkillsProfile;
      countryCode?: CountryCode;
    };
    if (!body.profile || !Array.isArray(body.profile.skills))
      return NextResponse.json({ error: "Missing profile.skills" }, { status: 400 });
    if (!body.countryCode)
      return NextResponse.json({ error: "Missing countryCode" }, { status: 400 });
    const matches = matchOccupations(body.profile, body.countryCode);
    const resilience = computeResilience(body.profile, body.countryCode, matches);
    return NextResponse.json({ matches, resilience });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
