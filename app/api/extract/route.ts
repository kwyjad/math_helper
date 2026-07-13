import { NextRequest, NextResponse } from "next/server";
import {
  EXTRACTION_SYSTEM_PROMPT,
  MODEL,
  MissingKeyError,
  getClient,
  isRateLimit,
  withBackoff,
} from "@/app/lib/gemini";
import type { Problem } from "@/app/lib/types";

export const runtime = "nodejs";
// Keep well under Vercel Hobby's function timeout.
export const maxDuration = 60;

interface ExtractBody {
  imageBase64?: string;
  mimeType?: string;
}

/** Strip any accidental markdown fences and parse the JSON array of problems. */
function parseProblems(raw: string): Problem[] {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  // Be forgiving: locate the outermost array if the model added stray prose.
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  const data = JSON.parse(text);
  if (!Array.isArray(data)) return [];

  return data.map((item, index): Problem => {
    const obj = (item ?? {}) as Record<string, unknown>;
    return {
      id: String(obj.id ?? index + 1),
      label: typeof obj.label === "string" ? obj.label : "",
      text: typeof obj.text === "string" ? obj.text : "",
      latex: typeof obj.latex === "string" ? obj.latex : "",
    };
  });
}

export async function POST(req: NextRequest) {
  let body: ExtractBody;
  try {
    body = (await req.json()) as ExtractBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { imageBase64, mimeType } = body;
  if (!imageBase64 || !mimeType) {
    return NextResponse.json(
      { error: "Please choose an image to upload." },
      { status: 400 }
    );
  }

  try {
    const ai = getClient();

    const response = await withBackoff(() =>
      ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [{ inlineData: { mimeType, data: imageBase64 } }],
          },
        ],
        config: {
          systemInstruction: EXTRACTION_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          temperature: 0,
        },
      })
    );

    const text = response.text ?? "";
    if (!text.trim()) {
      // Model returned nothing usable — treat as "no problems found".
      return NextResponse.json({ problems: [] });
    }

    let problems: Problem[];
    try {
      problems = parseProblems(text);
    } catch {
      return NextResponse.json(
        {
          error:
            "That image was hard to read. Try a clearer, well-lit photo of the page.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ problems });
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
    console.error("extract error:", err);
    return NextResponse.json(
      { error: "Something went wrong reading that image. Please try again." },
      { status: 500 }
    );
  }
}
