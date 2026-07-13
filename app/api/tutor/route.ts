import { NextRequest, NextResponse } from "next/server";
import {
  MODEL,
  buildTutorSystemPrompt,
  classifyError,
  getClient,
  withBackoff,
} from "@/app/lib/gemini";
import type { Option, TutorRequest } from "@/app/lib/types";

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
    mode: b.mode,
    submittedAnswer:
      typeof b.submittedAnswer === "string" ? b.submittedAnswer : undefined,
    answerImage:
      typeof b.answerImage === "string" && b.answerImage
        ? b.answerImage
        : undefined,
    answerImageMimeType:
      typeof b.answerImageMimeType === "string"
        ? b.answerImageMimeType
        : undefined,
  };
}

/**
 * In check mode we ask the model for a small structured verdict alongside its
 * reply so the app can offer the optional "teach it back" invitation after a
 * correct answer. The natural-language guidance (never reveal the answer, one
 * hint at a time, etc.) is unchanged — `correct` only reflects the submission.
 */
const CHECK_JSON_ADDENDUM = `\n\nThe student has submitted an answer to check. Respond ONLY as JSON, no fences:
{ "reply": "<your reply to the student, following all the guidance above; math in \\( \\) LaTeX>", "correct": <true if the submitted answer is actually correct, otherwise false> }
"correct" is a private signal for the app about whether their submission is right; it must NOT change what you write in "reply" (if it's wrong, still don't reveal the answer or which letter is correct).`;

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

/** Parse the check-mode JSON verdict; fall back to plain text if it isn't JSON. */
function parseCheckReply(text: string): { reply: string; correct: boolean | null } {
  try {
    const obj = JSON.parse(stripFences(text)) as Record<string, unknown>;
    if (obj && typeof obj.reply === "string" && obj.reply.trim()) {
      return {
        reply: obj.reply,
        correct: typeof obj.correct === "boolean" ? obj.correct : null,
      };
    }
  } catch {
    // Not JSON — treat the whole thing as the reply.
  }
  return { reply: text, correct: null };
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

  const baseInstruction = buildTutorSystemPrompt(
    data.age,
    data.problem.text,
    data.problem.latex,
    data.problem.options
  );
  // In check mode, ask for a structured { reply, correct } verdict (JSON mode)
  // so we can offer the optional teach-back invitation after a correct answer.
  const systemInstruction =
    data.mode === "check" ? baseInstruction + CHECK_JSON_ADDENDUM : baseInstruction;

  // Map the chat history onto Gemini's content format (assistant -> model).
  const contents: Content[] = data.history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // In check mode, append the submission as a final user turn. The student may
  // attach a photo of their work (e.g. a required drawing) — include it as an
  // image part so the tutor can evaluate it directly.
  if (data.mode === "check") {
    const answer = data.submittedAnswer ?? "";
    const note = data.answerImage
      ? `The student submits their answer to be checked. Typed answer: ${
          answer || "(none — see the attached photo)"
        }. They have also attached a photo of their own work — look at it and evaluate what they did.`
      : `The student submits this answer to be checked: ${answer}`;
    contents.push({
      role: "user",
      parts: withImage(
        [{ text: note }],
        data.answerImage,
        data.answerImageMimeType
      ),
    });
  }

  // Gemini requires the conversation to begin with a user turn.
  if (contents.length === 0 || contents[0].role !== "user") {
    return NextResponse.json(
      { error: "Say something to the tutor to get started." },
      { status: 400 }
    );
  }

  // Attach the page image (diagram/table) to the first user turn so the tutor
  // can read figures the text alone can't convey. Gemini is multimodal.
  contents[0] = {
    ...contents[0],
    parts: withImage(contents[0].parts, data.image, data.imageMimeType),
  };

  try {
    const ai = getClient();

    const response = await withBackoff(() =>
      ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction,
          // Keep replies short so functions stay fast and cheap. In check mode
          // the reply is wrapped in JSON so we can read the correctness verdict.
          maxOutputTokens: 500,
          temperature: 0.7,
          ...(data.mode === "check"
            ? { responseMimeType: "application/json" }
            : {}),
        },
      })
    );

    const rawText = (response.text ?? "").trim();
    if (!rawText) {
      return NextResponse.json(
        { error: "The tutor didn't have a response. Try rephrasing." },
        { status: 502 }
      );
    }

    if (data.mode === "check") {
      const { reply, correct } = parseCheckReply(rawText);
      const trimmed = reply.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: "The tutor didn't have a response. Try rephrasing." },
          { status: 502 }
        );
      }
      return NextResponse.json({ reply: trimmed, correct });
    }

    return NextResponse.json({ reply: rawText });
  } catch (err) {
    console.error("tutor error:", err);
    const { status, message } = classifyError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
