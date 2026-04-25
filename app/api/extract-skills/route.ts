import { NextResponse } from "next/server";
import { extractSkillsProfile, type ExtractInput } from "@/lib/llm";
import type { CountryCode } from "@/types";

const VALID_COUNTRIES: CountryCode[] = ["GH", "BD"];

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ExtractInput>;

    if (!body.countryCode || !VALID_COUNTRIES.includes(body.countryCode))
      return NextResponse.json({ error: "Invalid countryCode" }, { status: 400 });
    if (!body.story || body.story.trim().length < 10)
      return NextResponse.json(
        { error: "story must be at least 10 characters" },
        { status: 400 }
      );

    const profile = await extractSkillsProfile({
      countryCode: body.countryCode,
      educationLevel: body.educationLevel ?? "Unknown",
      languages: body.languages ?? [],
      yearsExperience: body.yearsExperience ?? 0,
      story: body.story,
      declaredSkills: body.declaredSkills ?? [],
    });

    return NextResponse.json(profile);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
