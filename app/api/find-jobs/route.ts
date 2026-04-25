import { NextResponse } from "next/server";
import { tavilySearch } from "@/lib/tavily";
import { getCountry } from "@/lib/config";

const SITE_HINTS: Record<string, string> = {
  GH: "site:jobberman.com.gh OR site:brightermonday.com.gh OR site:linkedin.com/jobs",
  BD: "site:bdjobs.com OR site:chakri.com OR site:linkedin.com/jobs",
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { title?: string; countryCode?: string };
    if (!body.title || !body.countryCode)
      return NextResponse.json({ error: "title + countryCode required" }, { status: 400 });
    const country = getCountry(body.countryCode);
    const hint = SITE_HINTS[country.code] ?? "";
    const query = `${body.title} jobs ${country.name} ${hint}`.trim();
    const hits = await tavilySearch(query, 4);
    return NextResponse.json({ jobs: hits });
  } catch (err) {
    return NextResponse.json({ jobs: [], error: err instanceof Error ? err.message : "Unknown" });
  }
}
