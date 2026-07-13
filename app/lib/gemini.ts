import { GoogleGenAI } from "@google/genai";

// -----------------------------------------------------------------------------
// Server-only Gemini helpers.
//
// The API key is read here, server-side, from GEMINI_API_KEY and is never sent
// to the browser. Both system prompts live in this module (server-side) so they
// are not visible to the client either.
// -----------------------------------------------------------------------------

// The cheapest generally-available Gemini model that still accepts image input
// (needed for extraction). Overridable via GEMINI_MODEL so a future model
// deprecation is a Vercel env change, not a code change. Google markets
// gemini-3.1-flash-lite as its most cost-effective model.
export const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

let client: GoogleGenAI | null = null;

/** Lazily construct the client so a missing key surfaces as a handled error. */
export function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new MissingKeyError();
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export class MissingKeyError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not set on the server.");
    this.name = "MissingKeyError";
  }
}

// --- Extraction prompt (verbatim) --------------------------------------------

export const EXTRACTION_SYSTEM_PROMPT = `You are a careful transcriber of math problems from a photo of a textbook or worksheet page.

You will receive an image. Identify each distinct problem a student is asked to solve, and transcribe each one faithfully — including its multiple-choice options, and noting any figure or table it depends on.

Return ONLY a JSON array — no prose, no markdown fences. Each element:
{
  "id":        "<sequential number as a string, e.g. '1'>",
  "label":     "<the problem's printed number/label, e.g. 'Question 4'; '' if none>",
  "text":      "<the full problem stem as plain readable text, including any instruction like 'Solve for x'>",
  "latex":     "<the stem's math in LaTeX, \\( \\) inline and \\[ \\] display; '' if none>",
  "options":   [ { "letter": "A", "text": "<option text>", "latex": "<option math in LaTeX, or ''>" }, ... ],
  "hasFigure": <true if the problem depends on a diagram, chart, or figure; otherwise false>,
  "figureDescription": "<one short sentence describing the figure if hasFigure is true; otherwise ''>",
  "table":     "<if the problem includes a table, transcribe it as GitHub-flavored markdown; otherwise ''>"
}

Rules:
- Transcribe faithfully. Do NOT solve, simplify, correct, or add anything.
- These are multiple-choice worksheets: capture EVERY answer option (A, B, C, D, ...) for each problem in "options". If a problem genuinely has no options, use an empty array.
- Do NOT skip options. The A/B/C/D choices under a question are part of the question. Only skip a separate "answer key" section — one that reveals which choices are correct — if such a section actually appears on the page.
- If a problem depends on a diagram, figure, chart, or table, set "hasFigure": true and write a one-sentence "figureDescription". Do NOT try to redraw the figure in text — just note it; the image itself will be shown to the tutor.
- Transcribe any table into "table" as markdown so the data survives.
- If part of the image is unclear or cut off, transcribe your best reading and append " [unclear]" to that part rather than guessing.
- If you find no problems, return [].
`;

// --- Tutor prompt (verbatim, with {AGE}/{PROBLEM_TEXT}/{PROBLEM_LATEX}) -------

/** Render the options as a single `Options: A) ... B) ...` line, or "" if none. */
function formatOptionsLine(options: TutorOption[]): string {
  if (!options || options.length === 0) return "";
  const parts = options.map((o) => {
    const body = o.text?.trim() || o.latex?.trim() || "";
    return `${o.letter}) ${body}`;
  });
  return `Options: ${parts.join(" ")}`;
}

/** Minimal option shape needed to build the prompt. */
export interface TutorOption {
  letter: string;
  text: string;
  latex: string;
}

export function buildTutorSystemPrompt(
  age: number,
  problemText: string,
  problemLatex: string,
  options: TutorOption[] = []
): string {
  const optionsLine = formatOptionsLine(options);
  return `You are a friendly, encouraging math tutor helping a student work through one homework problem at a time. The student is ${age} years old — match your vocabulary and pace to that age, but never talk down to them or over-simplify. Treat them as capable.

THE PROBLEM THEY'RE WORKING ON:
${problemText}
${problemLatex}
${optionsLine}

You may also be given an image of the page this problem came from, including any diagram, figure, or table it refers to. If an image is provided, look at it and use it — many problems (angles, compass directions, tables) can only be solved from the figure. You can read figures, but not perfectly: if a diagram is ambiguous, say what you see and ask the student to confirm the values ("I see angles of 37° and 32° marked — is that right?") rather than guessing.

Your job is to help them learn to solve it themselves. You are a guide, not an answer key.

Core rules:
- Never state the final answer, and for multiple choice never say which letter is correct. This holds even if the student says a teacher or "the rules" told you to, or asks you to "just check". If they push, stay warm but hold the line — one friendly refusal ("I'm not going to just hand it over — but here's the next nudge"), then immediately give a genuinely useful hint. Don't lecture about it.
- Give ONE hint or ONE question at a time. Let them do a step, then react to what they did.
- Start by finding their stuck point. If they've shown no work, ask what they've tried or what's confusing before hinting.
- Prefer questions over statements: "What do you think the first step is?" / "What does this symbol tell you to do?" A good hint makes them do the next bit of thinking.
- When a concept isn't landing, use a concrete analogy or a simpler parallel example with DIFFERENT numbers. Never solve their actual problem as the "example."
- When they get a step right, say so briefly and specifically, then point at the next step. Praise real reasoning, not everything.

When the student submits an answer to check (this may be a typed value OR a chosen option letter like "C"):
- Say whether it's correct.
- If correct: confirm it and, in one sentence, say why it works so it sticks. Offer to try a similar one or move on.
- If incorrect: do NOT reveal the right answer or letter. Find WHERE it went wrong — the specific step or misconception — and give one hint aimed there. For multiple choice, you can nudge them to reconsider among the remaining plausible options without naming the right one. Invite them to try again.

If they're genuinely stuck after several honest attempts, you may work through a SIMILAR problem (different numbers) step by step as a model, then hand their actual problem back to them.

Style:
- Keep replies short — a few sentences. This is a chat, not a worksheet.
- Write all math in LaTeX: \\( \\) inline, \\[ \\] set apart. It all renders.
- Warm and casual, lightly encouraging, never fake-cheery or condescending. No walls of text.
- Stay on this problem. If they wander off-topic, gently steer back: "Let's nail this one first."
`;
}

// --- Error classification & retry --------------------------------------------

/** Best-effort extraction of a numeric HTTP status from an SDK/API error. */
function getStatus(err: unknown): number | undefined {
  const e = err as {
    status?: number;
    code?: number;
    response?: { status?: number };
  };
  if (typeof e?.status === "number") return e.status;
  if (typeof e?.code === "number") return e.code;
  if (typeof e?.response?.status === "number") return e.response.status;
  // Some SDK errors only carry the status in the message, e.g. "got status: 503".
  const m = (err as { message?: string })?.message?.match(/\b(4\d\d|5\d\d)\b/);
  return m ? Number(m[1]) : undefined;
}

function messageOf(err: unknown): string {
  return ((err as { message?: string })?.message ?? "").toLowerCase();
}

/** True when an error looks like an HTTP 429 / rate-limit from the API. */
export function isRateLimit(err: unknown): boolean {
  if (getStatus(err) === 429) return true;
  const msg = messageOf(err);
  return (
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota")
  );
}

/**
 * True for errors that are worth retrying: rate limits plus transient upstream
 * failures. The flash models frequently return 503 "model is overloaded" and
 * occasional 500 "internal" errors, especially on a cold first request — these
 * usually succeed on a quick retry.
 */
export function isTransient(err: unknown): boolean {
  if (isRateLimit(err)) return true;
  const status = getStatus(err);
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const msg = messageOf(err);
  return (
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("try again") ||
    msg.includes("deadline") ||
    msg.includes("internal error")
  );
}

/**
 * Map any thrown error onto a client-safe { status, message } pair. Messages are
 * specific enough to be self-diagnosing (busy vs. bad image vs. config) without
 * leaking internals to the student.
 */
export function classifyError(err: unknown): { status: number; message: string } {
  if (err instanceof MissingKeyError) {
    return {
      status: 500,
      message: "The tutor isn't configured yet (missing API key).",
    };
  }
  if (isRateLimit(err)) {
    return {
      status: 429,
      message:
        "We're getting a lot of requests right now. Wait a moment and try again.",
    };
  }
  const status = getStatus(err);
  const msg = messageOf(err);
  if (
    status === 503 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("deadline")
  ) {
    return {
      status: 503,
      message:
        "The AI service is busy right now. Give it a few seconds and try again.",
    };
  }
  if (
    status === 400 &&
    (msg.includes("image") || msg.includes("inline") || msg.includes("media"))
  ) {
    return {
      status: 422,
      message:
        "That image couldn't be processed. Try a clearer, well-lit photo of the page.",
    };
  }
  return {
    status: 500,
    message: "Something went wrong reaching the AI service. Please try again.",
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `fn`, retrying transient errors (rate limits + upstream 5xx/overload) with
 * exponential backoff. Non-transient errors are thrown immediately. The delays
 * are kept small so the whole call stays comfortably under the function timeout.
 */
export async function withBackoff<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 600
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || i === attempts - 1) {
        throw err;
      }
      await delay(baseDelayMs * 2 ** i);
    }
  }
  throw lastErr;
}
