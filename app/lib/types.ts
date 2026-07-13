// Shared types used by both the client UI and the server API routes.

/** A single multiple-choice answer option (A, B, C, …). */
export interface Option {
  /** The option's letter, e.g. "A". */
  letter: string;
  /** The option text as plain readable text. */
  text: string;
  /** The option's math in LaTeX, or "" if none. */
  latex: string;
}

export interface Problem {
  /** Sequential id assigned during extraction, e.g. "1". Stable per list. */
  id: string;
  /** The problem's printed number/letter, e.g. "4a". "" if none. */
  label: string;
  /** The full problem as plain readable text (editable by the student). */
  text: string;
  /** The math written in LaTeX, or "" if no math notation. */
  latex: string;
  /** Multiple-choice options; empty array if not multiple choice. */
  options: Option[];
  /** True if the problem depends on a diagram, chart, or figure. */
  hasFigure: boolean;
  /** One short sentence describing the figure, or "" if none. */
  figureDescription: string;
  /** Any table transcribed as GitHub-flavored markdown, or "" if none. */
  table: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type TutorMode = "hint" | "check";

/** Request body for POST /api/tutor. */
export interface TutorRequest {
  age: number;
  problem: {
    text: string;
    latex: string;
    options: Option[];
    hasFigure: boolean;
    figureDescription: string;
    table: string;
  };
  /** Base64 (no data: prefix) of the page image, when available. */
  image?: string;
  /** MIME type of `image`; defaults to image/jpeg server-side. */
  imageMimeType?: string;
  history: ChatMessage[];
  mode: TutorMode;
  /** In check mode: a typed value OR a chosen option letter (e.g. "C"). */
  submittedAnswer?: string;
  /** In check mode: base64 of a photo of the student's work (e.g. a drawing). */
  answerImage?: string;
  /** MIME type of `answerImage`; defaults to image/jpeg server-side. */
  answerImageMimeType?: string;
}
