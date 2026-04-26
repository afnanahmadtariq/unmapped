import { NextResponse } from "next/server";
import { tavilySearch } from "@/lib/tavily";
import { getCountry } from "@/lib/config";

// Country-specific job-board hints. The `?? ""` fallback means any other
// country still gets a reasonable Tavily query (just country-named).
const SITE_HINTS: Record<string, string> = {
  GH: "site:jobberman.com.gh OR site:brightermonday.com.gh OR site:linkedin.com/jobs",
  BD: "site:bdjobs.com OR site:chakri.com OR site:linkedin.com/jobs",
  KE: "site:brightermonday.co.ke OR site:fuzu.com OR site:linkedin.com/jobs",
  NG: "site:jobberman.com OR site:hotnigerianjobs.com OR site:linkedin.com/jobs",
  ZA: "site:careerjunction.co.za OR site:pnet.co.za OR site:linkedin.com/jobs",
  EG: "site:wuzzuf.net OR site:bayt.com OR site:linkedin.com/jobs",
  PK: "site:rozee.pk OR site:mustakbil.com OR site:linkedin.com/jobs",
  IN: "site:naukri.com OR site:shine.com OR site:linkedin.com/jobs",
  ID: "site:jobstreet.co.id OR site:linkedin.com/jobs",
  PH: "site:jobstreet.com.ph OR site:linkedin.com/jobs",
  VN: "site:vietnamworks.com OR site:linkedin.com/jobs",
  BR: "site:catho.com.br OR site:vagas.com.br OR site:linkedin.com/jobs",
  MX: "site:occ.com.mx OR site:computrabajo.com.mx OR site:linkedin.com/jobs",
  TR: "site:kariyer.net OR site:secretcv.com OR site:linkedin.com/jobs",
  RU: "site:hh.ru OR site:linkedin.com/jobs",
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { title?: string; countryCode?: string };
    if (!body.title || !body.countryCode)
      return NextResponse.json({ error: "title + countryCode required" }, { status: 400 });
    const country = getCountry(body.countryCode);
    const hint = SITE_HINTS[country.code] ?? "site:linkedin.com/jobs";
    const query = `${body.title} jobs ${country.name} ${hint}`.trim();
    const hits = await tavilySearch(query, 4);
    return NextResponse.json({ jobs: hits });
  } catch (err) {
    return NextResponse.json({ jobs: [], error: err instanceof Error ? err.message : "Unknown" });
  }
}
