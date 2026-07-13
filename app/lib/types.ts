// Shared types used by both the client UI and the server API routes.

export interface Problem {
  /** Sequential id assigned during extraction, e.g. "1". Stable per list. */
  id: string;
  /** The problem's printed number/letter, e.g. "4a". "" if none. */
  label: string;
  /** The full problem as plain readable text (editable by the student). */
  text: string;
  /** The math written in LaTeX, or "" if no math notation. */
  latex: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type TutorMode = "hint" | "check";

/** Request body for POST /api/tutor. */
export interface TutorRequest {
  age: number;
  problem: { text: string; latex: string };
  history: ChatMessage[];
  mode: TutorMode;
  submittedAnswer?: string;
}
