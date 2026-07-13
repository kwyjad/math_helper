// Shared types used by both the client UI and the server API routes.

import type { CompanionId } from "./companions";

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

/** Response body for POST /api/tutor. */
export interface TutorResponse {
  reply: string;
  /**
   * In `check` mode only: whether the submitted answer is correct. `null` when
   * the model's structured verdict couldn't be parsed, or in `hint` mode. Drives
   * the optional "teach it back" invitation — never revealed to the student.
   */
  correct?: boolean | null;
}

// -----------------------------------------------------------------------------
// Teach-back (Teach Zeb) types.
// -----------------------------------------------------------------------------

/** The subset of a Problem the teach-back route needs to build its prompt. */
export interface TeachbackProblem {
  text: string;
  latex: string;
  options: Option[];
  hasFigure: boolean;
  figureDescription: string;
  table: string;
}

/** Request body for POST /api/teachback. */
export interface TeachbackRequest {
  age: number;
  /** Which companion drives this session: Zeb (taught) or Loftus (caught). */
  character: CompanionId;
  problem: TeachbackProblem;
  /** Base64 (no data: prefix) of the page image, when available. */
  image?: string;
  /** MIME type of `image`; defaults to image/jpeg server-side. */
  imageMimeType?: string;
  history: ChatMessage[];
}

/**
 * Character-agnostic structured reply from POST /api/teachback.
 * For Zeb, `progress` is how well he understands (0 = lost, 100 = got it).
 * For Sir Loftus, `progress` is how thoroughly he's been corrected
 * (0 = peak arrogance, 100 = fully conceded). `done` = session succeeded.
 */
export interface TeachbackResponse {
  /** The companion's reply, in their voice; math in \( \) LaTeX. */
  says: string;
  /** 0–100 progress toward the session's success condition. */
  progress: number;
  /** True once the session has succeeded. */
  done: boolean;
  /** When done is true, one short line in the companion's voice; else "". */
  scrapbookLine: string;
}

/** One keepsake entry in the Scrapbook (persisted in localStorage). */
export interface ScrapbookEntry {
  /** Which companion this page is about. */
  character: CompanionId;
  /** The problem's label or position, e.g. "Problem 4a". */
  problemLabel: string;
  /** ISO date string of when it was taught/caught. */
  date: string;
  /** The companion's goofy one-liner about what got learned/sorted out. */
  scrapbookLine: string;
}
