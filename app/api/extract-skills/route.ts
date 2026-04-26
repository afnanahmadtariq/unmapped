import { NextResponse } from "next/server";
import {
  continueWithAnswers,
  extractInitial,
  type ExtractInput,
} from "@/lib/llm";
import type { CountryCode } from "@/types";
import type Anthropic from "@anthropic-ai/sdk";

const VALID_COUNTRIES: CountryCode[] = ["GH", "BD"];

interface RequestBody extends Partial<ExtractInput> {
  phase?: "initial" | "follow-up";
  history?: Anthropic.Messages.MessageParam[];
  lastAssistant?: Anthropic.Messages.Message["content"];
  answers?: Record<string, string>;
  baseInput?: ExtractInput;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;

    if (body.phase === "follow-up") {
      if (!body.history || !body.lastAssistant || !body.answers || !body.baseInput)
        return NextResponse.json(
          { error: "follow-up needs history, lastAssistant, answers, baseInput" },
          { status: 400 }
        );
      const result = await continueWithAnswers(
        body.baseInput,
        body.history,
        body.lastAssistant,
        body.answers
      );
      // For follow-up turns, the route only returns the result + the assistant
      // block. The client extends its own history via the previous response.
      return NextResponse.json({ result, baseInput: body.baseInput });
    }

    // Initial turn
    if (!body.countryCode || !VALID_COUNTRIES.includes(body.countryCode))
      return NextResponse.json({ error: "Invalid countryCode" }, { status: 400 });
    if (!body.story || body.story.trim().length < 10)
      return NextResponse.json(
        { error: "story must be at least 10 characters" },
        { status: 400 }
      );

    const baseInput: ExtractInput = {
      countryCode: body.countryCode,
      educationLevel: body.educationLevel ?? "Unknown",
      languages: body.languages ?? [],
      yearsExperience: body.yearsExperience ?? 0,
      story: body.story,
      declaredSkills: body.declaredSkills ?? [],
      demographics: body.demographics,
      context: body.context,
    };

    const { result, history } = await extractInitial(baseInput);
    return NextResponse.json({ result, history, baseInput });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
