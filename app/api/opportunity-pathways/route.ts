import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCountry } from "@/lib/config";
import { getCountryData } from "@/lib/data";
import type { Opportunity } from "@/types";

const MODEL = "claude-sonnet-4-5";

const TOOL = {
  name: "save_opportunity_pathways",
  description:
    "Save 4 reachable opportunity pathways for a young person — one of each type: formal employment, self-employment, gig work, training pathway. Be honest and grounded — no aspirational fluff.",
  input_schema: {
    type: "object" as const,
    properties: {
      opportunities: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            type: { type: "string" as const, enum: ["formal", "self-employment", "gig", "training"] },
            title: { type: "string" as const, description: "Short, specific title (≤60 chars)" },
            source: { type: "string" as const, description: "Where this opportunity is found locally — name a real platform, ministry, NGO or category" },
            estimatedEarning: { type: "string" as const, description: "Realistic local-currency range, or 'free' for training" },
            timeToReadiness: { type: "string" as const, description: "Honest time estimate, e.g. 'apply this week', '3-month course'" },
            description: { type: "string" as const, description: "One concrete sentence the user can act on" },
          },
          required: ["type", "title", "source", "description"],
        },
      },
    },
    required: ["opportunities"],
  },
};

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
  _client = new Anthropic({ apiKey });
  return _client;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      occupationTitle?: string;
      iscoCode?: string;
      countryCode?: string;
      matchedSkills?: string[];
    };
    if (!body.occupationTitle || !body.countryCode)
      return NextResponse.json({ error: "occupationTitle + countryCode required" }, { status: 400 });

    const country = getCountry(body.countryCode);
    const data = getCountryData(country.code);

    const prompt = [
      `Country: ${country.name} (${country.context} economy, informal share ${data.growth.informalEmploymentShare}%, youth unemployment ${data.growth.youthUnemploymentRate}%)`,
      `Currency: ${data.wages.currency} (minimum wage ${data.wages.minimumWage}/mo)`,
      `Target occupation: ${body.occupationTitle} (ISCO ${body.iscoCode ?? "n/a"})`,
      `User already has skills in: ${(body.matchedSkills ?? []).join(", ") || "(generalist)"}`,
      "",
      "Generate exactly 4 reachable opportunity pathways — one each of: formal, self-employment, gig, training.",
      "Each must be specific, locally realistic, and actionable within 3 months. Name real local platforms (Jobberman, BrighterMonday, NVTI, Bdjobs, BTEB, SEIP, etc.) where possible. No global fluff.",
    ].join("\n");

    const response = await client().messages.create({
      model: MODEL,
      max_tokens: 1200,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use")
      return NextResponse.json({ opportunities: [] });

    const parsed = toolUse.input as { opportunities: Array<Omit<Opportunity, "id">> };
    const opportunities: Opportunity[] = parsed.opportunities.map((o, i) => ({
      ...o,
      id: `${body.iscoCode}-${i}`,
    }));
    return NextResponse.json({ opportunities });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
