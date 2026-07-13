import { NextRequest, NextResponse } from "next/server";
import {
  MODEL,
  TEACHBACK_KICKOFF,
  buildTeachbackSystemPrompt,
  classifyError,
  getClient,
  withBackoff,
} from "@/app/lib/gemini";
import type { CompanionId } from "@/app/lib/companions";
import type { Option, TeachbackRequest, TeachbackResponse } from "@/app/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type TextPart = { text: string };
type ImagePart = { inlineData: { mimeType: string; data: string } };
type Content = { role: "user" | "model"; parts: (TextPart | ImagePart)[] };

/** Coerce an unknown `options` value into a clean Option[] (or [] if absent). */
function parseOptions(raw: unknown): Option[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): Option | null => {
      const obj = (item ?? {}) as Record<string, unknown>;
      const letter = typeof obj.letter === "string" ? obj.letter : "";
      const text = typeof obj.text === "string" ? obj.text : "";
      const latex = typeof obj.latex === "string" ? obj.latex : "";
      if (!letter && !text && !latex) return null;
      return { letter, text, latex };
    })
    .filter((o): o is Option => o !== null);
}

function validate(body: unknown): TeachbackRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  if (typeof b.age !== "number" || !Number.isFinite(b.age)) return null;

  const character: CompanionId = b.character === "loftus" ? "loftus" : "zeb";

  const problem = b.problem as Record<string, unknown> | undefined;
  if (!problem || typeof problem.text !== "string") return null;

  if (!Array.isArray(b.history)) return null;

  return {
    age: b.age,
    character,
    problem: {
      text: problem.text,
      latex: typeof problem.latex === "string" ? problem.latex : "",
      options: parseOptions(problem.options),
      hasFigure: problem.hasFigure === true,
      figureDescription:
        typeof problem.figureDescription === "string"
          ? problem.figureDescription
          : "",
      table: typeof problem.table === "string" ? problem.table : "",
    },
    image: typeof b.image === "string" && b.image ? b.image : undefined,
    imageMimeType:
      typeof b.imageMimeType === "string" ? b.imageMimeType : undefined,
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
  };
}

/** Prepend the page image to a content's parts so Gemini sees it in context. */
function withImage(
  parts: (TextPart | ImagePart)[],
  image: string | undefined,
  mimeType: string | undefined
): (TextPart | ImagePart)[] {
  if (!image) return parts;
  return [
    { inlineData: { mimeType: mimeType || "image/jpeg", data: image } },
    ...parts,
  ];
}

/** Strip accidental ```json fences the model may add despite JSON mode. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return trimmed;
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Parse the companion's structured JSON reply, defaulting each field. */
function parseReply(text: string): TeachbackResponse | null {
  let obj: unknown;
  try {
    obj = JSON.parse(stripFences(text));
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;
  const says = typeof o.says === "string" ? o.says : "";
  if (!says.trim()) return null;
  const progress = clamp(
    typeof o.progress === "number" ? o.progress : Number(o.progress)
  );
  const done = o.done === true;
  const scrapbookLine =
    done && typeof o.scrapbookLine === "string" ? o.scrapbookLine : "";
  return { says, progress, done, scrapbookLine };
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
      { error: "Missing or invalid teach-back request fields." },
      { status: 400 }
    );
  }

  const systemInstruction = buildTeachbackSystemPrompt(
    data.character,
    data.age,
    data.problem.text,
    data.problem.latex,
    data.problem.options
  );

  // The companion speaks first, but Gemini requires the conversation to start
  // with a user turn — so prepend a synthetic kickoff turn (never shown in the
  // client chat) carrying the page image, then map the real chat history after.
  const contents: Content[] = [
    {
      role: "user",
      parts: withImage(
        [{ text: TEACHBACK_KICKOFF[data.character] }],
        data.image,
        data.imageMimeType
      ),
    },
    ...data.history.map((m) => ({
      role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
      parts: [{ text: m.content }] as (TextPart | ImagePart)[],
    })),
  ];

  try {
    const ai = getClient();

    const response = await withBackoff(() =>
      ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          maxOutputTokens: 600,
          temperature: 0.9,
        },
      })
    );

    const parsed = parseReply(response.text ?? "");
    if (!parsed) {
      return NextResponse.json(
        { error: "The companion got a bit distracted. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("teachback error:", err);
    const { status, message } = classifyError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
