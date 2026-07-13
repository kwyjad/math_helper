"use client";

import type { ChatMessage, Problem } from "./types";

// -----------------------------------------------------------------------------
// localStorage persistence. Per-device only — no accounts, no server storage.
// Every accessor is guarded so it is safe to call during SSR / before hydration.
// -----------------------------------------------------------------------------

const KEYS = {
  age: "mathhelper.age",
  problems: "mathhelper.problems",
  chats: "mathhelper.chats",
  image: "mathhelper.image",
} as const;

/** The current page image, stored as a compressed JPEG data URL prefix-less base64. */
export interface StoredImage {
  base64: string;
  mimeType: string;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readJSON<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled — degrade gracefully to session-only.
  }
}

export function loadAge(): number | null {
  const value = readJSON<number | null>(KEYS.age, null);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function saveAge(age: number): void {
  writeJSON(KEYS.age, age);
}

/**
 * Fill in any fields missing from data saved by an older version of the app so
 * the UI never crashes on `options`/`hasFigure`/`table` being undefined.
 */
export function normalizeProblem(raw: unknown): Problem {
  const p = (raw ?? {}) as Record<string, unknown>;
  const options = Array.isArray(p.options)
    ? (p.options as unknown[])
        .map((o) => {
          const obj = (o ?? {}) as Record<string, unknown>;
          return {
            letter: typeof obj.letter === "string" ? obj.letter : "",
            text: typeof obj.text === "string" ? obj.text : "",
            latex: typeof obj.latex === "string" ? obj.latex : "",
          };
        })
        .filter((o) => o.letter || o.text || o.latex)
    : [];
  return {
    id: typeof p.id === "string" ? p.id : String(p.id ?? ""),
    label: typeof p.label === "string" ? p.label : "",
    text: typeof p.text === "string" ? p.text : "",
    latex: typeof p.latex === "string" ? p.latex : "",
    options,
    hasFigure: p.hasFigure === true,
    figureDescription:
      typeof p.figureDescription === "string" ? p.figureDescription : "",
    table: typeof p.table === "string" ? p.table : "",
  };
}

export function loadProblems(): Problem[] {
  const value = readJSON<unknown[]>(KEYS.problems, []);
  return Array.isArray(value) ? value.map(normalizeProblem) : [];
}

export function saveProblems(problems: Problem[]): void {
  writeJSON(KEYS.problems, problems);
}

export function loadImage(): StoredImage | null {
  const value = readJSON<StoredImage | null>(KEYS.image, null);
  if (
    value &&
    typeof value === "object" &&
    typeof value.base64 === "string" &&
    value.base64
  ) {
    return {
      base64: value.base64,
      mimeType:
        typeof value.mimeType === "string" && value.mimeType
          ? value.mimeType
          : "image/jpeg",
    };
  }
  return null;
}

export function saveImage(image: StoredImage | null): void {
  if (image === null) {
    if (!canUseStorage()) return;
    try {
      window.localStorage.removeItem(KEYS.image);
    } catch {
      // ignore
    }
    return;
  }
  writeJSON(KEYS.image, image);
}

/** Per-problem chat history, keyed by problem id. */
export type ChatMap = Record<string, ChatMessage[]>;

export function loadChats(): ChatMap {
  const value = readJSON<ChatMap>(KEYS.chats, {});
  return value && typeof value === "object" ? value : {};
}

export function saveChats(chats: ChatMap): void {
  writeJSON(KEYS.chats, chats);
}

/** Wipe everything Math Helper has stored on this device. */
export function clearAll(): void {
  if (!canUseStorage()) return;
  for (const key of Object.values(KEYS)) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
