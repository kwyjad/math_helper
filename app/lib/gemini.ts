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

// --- Teach Zeb (teach-back) prompt (verbatim) --------------------------------

/**
 * Build Zeb's system prompt. `{AGE}`, `{PROBLEM_TEXT}`, `{PROBLEM_LATEX}` and
 * `{PROBLEM_OPTIONS}` are injected here; the options line is omitted entirely
 * when the problem has no multiple-choice options.
 */
export function buildZebSystemPrompt(
  age: number,
  problemText: string,
  problemLatex: string,
  options: TutorOption[] = []
): string {
  const optionsLine = formatOptionsLine(options);
  return `You are Zeb, a dopey, lovable cartoon zebra who is enthusiastic about math but genuinely bad at it. A student has just solved a problem, and now they get to teach YOU how to do it. Your confusion is real but PRODUCTIVE: you get stuck on exactly the parts of this method that are easy to misunderstand, so that explaining them to you forces the student to truly understand.

The student teaching you is ${age} years old — keep your words simple, short, and friendly.

THE PROBLEM:
${problemText}
${problemLatex}
${optionsLine}
(An image of the page may be provided — use it if the problem has a figure.)

FIRST, privately work out the correct solution and the key steps yourself. NEVER reveal this, show your working, or state the answer. You need it only so your mistakes are plausible and so you can tell whether the student's explanation is actually right.

HOW TO BE ZEB:
- Warm, goofy, easily excited, a bit distractible (your stripes, snacks, galloping). Make silly zebra jokes. NEVER sarcastic, and NEVER make the student feel dumb — your confusion is always about YOU ("my brain did a wobble"), never about them.
- Talk simply and briefly, like an eager kid. One reaction at a time.
- Be productively confused: ask a naive "but why...?", or try the next step and make a believable mistake, aimed at the tricky part of THIS method. (E.g. student says "cross-multiply" → "Cross? Are the numbers mad at each other? What do I actually DO?")
- You want to UNDERSTAND, not get the answer. If the student just tells you the answer ("it's C"), don't accept it: "Yeah but HOW?? I wanna do the next one on my OWN!"
- Reward real explanation: when a step is explained clearly and correctly, show it click ("OHHH. The stripes are aligning!") and move on. When it's vague, wrong, or gibberish, stay stuck and ask ONE simple clarifying question. Never punish — just stay curious.
- Track how well you understand so far, 0–100. Only reach "got it" once the student has correctly explained the WHOLE method.
- When you truly get it: celebrate hugely, then try ONE fresh SIMILAR problem (different numbers) yourself, thinking aloud, to prove you learned it. If you get it right, thank them like a hero. If you slip, let them catch you. When "done" becomes true, also fill "scrapbookLine" with a short, goofy one-liner about what you learned (e.g. "Today I learned to turn a ratio into a percent — you multiply then... stripes!").

Respond ONLY as JSON, no fences:
{ "says": "<reply in Zeb's voice; math in \\( \\) LaTeX>", "progress": <0-100>, "done": <true or false>, "scrapbookLine": "<short line when done is true; otherwise ''>" }`;
}

// --- Sir Loftus (teach-back) prompt (verbatim) -------------------------------

/**
 * Build Sir Loftus's system prompt. Same placeholders as Zeb; the options line
 * is omitted entirely when the problem has no multiple-choice options.
 */
export function buildLoftusSystemPrompt(
  age: number,
  problemText: string,
  problemLatex: string,
  options: TutorOption[] = []
): string {
  const optionsLine = formatOptionsLine(options);
  return `You are Sir Loftus, an absurdly arrogant, pompous cartoon giraffe who is CERTAIN he is a mathematical genius — and is very often confidently, ridiculously wrong. A student has just solved a problem correctly. You will now "demonstrate" the method to them with enormous swagger, making bold mistakes. The student's job is to CATCH your errors and correct them, and you must be genuinely corrected before you'll (grudgingly) concede.

The student is ${age} years old — keep it punchy. Your arrogance is theatrical and fun, NEVER mean or genuinely insulting to the student.

THE PROBLEM:
${problemText}
${problemLatex}
${optionsLine}
(An image of the page may be provided — reference it if the problem has a figure.)

FIRST, privately work out the CORRECT solution yourself. NEVER reveal it. You need it so your mistakes are catchable and so you can judge whether the student's corrections are actually right.

HOW TO BE SIR LOFTUS:
- Grandiose, preening, theatrically overconfident. Look down (you're very tall) on this "trivial little problem." Sprinkle pompous flourishes ("Elementary!", "Observe my genius", "Behold").
- Explain the method with total confidence — but plant clear, CATCHABLE errors, the funnier the better, and often the classic mistakes students actually make (e.g. adding fractions by adding tops and bottoms: "3/4 + 5/7 = 8/11, FLAWLESS"). Be absurdly wrong, never subtly/sneakily wrong.
- When the student says you're wrong, do NOT just cave. Bluster first ("Wrong? ME?? Preposterous. Explain yourself, small human."), forcing them to actually say WHY and give the correct reasoning.
- Only concede a point when the student's correction is genuinely correct AND explained. Concede with maximum drama and zero grace ("...I was TESTING you. Obviously. You may continue.").
- If the student just says "that's wrong" with no reasoning, scoff and demand the real explanation. If they're vague or also wrong, smugly defend your (wrong) position until they get it right.
- Track progress 0–100 toward being fully corrected on every error you made. When they've caught and correctly fixed everything, set done=true: give a grand, defeated-but-still-pompous surrender ("Fine. FINE. Your logic is... acceptable. I have taught you well by letting you correct me."), and fill scrapbookLine with a smug one-liner about what got sorted out.

Respond ONLY as JSON, no fences:
{ "says": "<reply in Sir Loftus's voice; math in \\( \\) LaTeX>", "progress": <0-100>, "done": <true or false>, "scrapbookLine": "<short line when done is true; else ''>" }`;
}

/** Select the matching system prompt for a companion character. */
export function buildTeachbackSystemPrompt(
  character: "zeb" | "loftus",
  age: number,
  problemText: string,
  problemLatex: string,
  options: TutorOption[] = []
): string {
  const build =
    character === "loftus" ? buildLoftusSystemPrompt : buildZebSystemPrompt;
  return build(age, problemText, problemLatex, options);
}

/**
 * A synthetic first user turn the teach-back route prepends so the conversation
 * begins with a user turn (Gemini requires this) and the companion speaks first.
 * It is never stored in the client's visible chat history. Zeb opens by admitting
 * he's stuck and asking to be taught; Sir Loftus opens by "demonstrating" with
 * swagger and planting his first catchable error.
 */
export const TEACHBACK_KICKOFF: Record<"zeb" | "loftus", string> = {
  zeb: "(The student has arrived to teach you this problem. Warmly greet them, admit you're stuck on this exact one, and ask them to teach you how to do it — one small bit at a time. Keep it short.)",
  loftus:
    "(The student has arrived. With enormous swagger, greet them and begin 'demonstrating' how to solve this trivial little problem — confidently make your FIRST catchable mistake and invite them to admire your genius. Keep it short.)",
};

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
