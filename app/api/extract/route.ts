import { NextRequest, NextResponse } from "next/server";
import {
  EXTRACTION_SYSTEM_PROMPT,
  MODEL,
  classifyError,
  getClient,
  withBackoff,
} from "@/app/lib/gemini";
import type { Option, Problem } from "@/app/lib/types";

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
      options: parseOptions(obj.options),
      hasFigure: obj.hasFigure === true,
      figureDescription:
        typeof obj.figureDescription === "string" ? obj.figureDescription : "",
      table: typeof obj.table === "string" ? obj.table : "",
    };
  });
}

/** Coerce the model's `options` field into a clean Option[] (or [] if absent). */
function parseOptions(raw: unknown): Option[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): Option | null => {
      const obj = (item ?? {}) as Record<string, unknown>;
      const letter = typeof obj.letter === "string" ? obj.letter : "";
      const text = typeof obj.text === "string" ? obj.text : "";
      const latex = typeof obj.latex === "string" ? obj.latex : "";
      // Drop entries with no usable content.
      if (!letter && !text && !latex) return null;
      return { letter, text, latex };
    })
    .filter((o): o is Option => o !== null);
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
    // Full detail goes to the server logs (visible in Vercel) for diagnosis;
    // the client gets a specific-but-friendly message from classifyError.
    console.error("extract error:", err);
    const { status, message } = classifyError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
