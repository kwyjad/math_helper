import { NextRequest, NextResponse } from "next/server";
import {
  MODEL,
  MissingKeyError,
  buildTutorSystemPrompt,
  getClient,
  isRateLimit,
  withBackoff,
} from "@/app/lib/gemini";
import type { TutorRequest } from "@/app/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Content = { role: "user" | "model"; parts: { text: string }[] };

function validate(body: unknown): TutorRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  if (typeof b.age !== "number" || !Number.isFinite(b.age)) return null;
  if (b.mode !== "hint" && b.mode !== "check") return null;

  const problem = b.problem as Record<string, unknown> | undefined;
  if (!problem || typeof problem.text !== "string") return null;

  if (!Array.isArray(b.history)) return null;

  return {
    age: b.age,
    problem: {
      text: problem.text,
      latex: typeof problem.latex === "string" ? problem.latex : "",
    },
    history: (b.history as unknown[])
      .filter(
        (m): m is { role: "user" | "assistant"; content: string } =>
          typeof m === "object" &&
          m !== null &&
          (("role" in m &&
            ((m as { role: unknown }).role === "user" ||
              (m as { role: unknown }).role === "assistant")) as boolean) &&
          typeof (m as { content: unknown }).content === "string"
      )
      .map((m) => ({ role: m.role, content: m.content })),
    mode: b.mode,
    submittedAnswer:
      typeof b.submittedAnswer === "string" ? b.submittedAnswer : undefined,
  };
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const data = validate(raw);
  if (!data) {
    return NextResponse.json(
      { error: "Missing or invalid tutor request fields." },
      { status: 400 }
    );
  }

  const systemInstruction = buildTutorSystemPrompt(
    data.age,
    data.problem.text,
    data.problem.latex
  );

  // Map the chat history onto Gemini's content format (assistant -> model).
  const contents: Content[] = data.history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // In check mode, append the submission as a final user turn.
  if (data.mode === "check") {
    const answer = data.submittedAnswer ?? "";
    contents.push({
      role: "user",
      parts: [
        { text: `The student submits this answer to be checked: ${answer}` },
      ],
    });
  }

  // Gemini requires the conversation to begin with a user turn.
  if (contents.length === 0 || contents[0].role !== "user") {
    return NextResponse.json(
      { error: "Say something to the tutor to get started." },
      { status: 400 }
    );
  }

  try {
    const ai = getClient();

    const response = await withBackoff(() =>
      ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction,
          // Keep replies short so functions stay fast and cheap.
          maxOutputTokens: 500,
          temperature: 0.7,
        },
      })
    );

    const reply = (response.text ?? "").trim();
    if (!reply) {
      return NextResponse.json(
        { error: "The tutor didn't have a response. Try rephrasing." },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof MissingKeyError) {
      return NextResponse.json(
        { error: "The tutor isn't configured yet (missing API key)." },
        { status: 500 }
      );
    }
    if (isRateLimit(err)) {
      return NextResponse.json(
        {
          error:
            "We're getting a lot of requests right now. Wait a moment and try again.",
        },
        { status: 429 }
      );
    }
    console.error("tutor error:", err);
    return NextResponse.json(
      { error: "Something went wrong reaching the tutor. Please try again." },
      { status: 500 }
    );
  }
}
