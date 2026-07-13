"use client";

import { ACCESSORIES } from "./accessories";
import type { ChatMessage, Problem, ScrapbookEntry } from "./types";

// -----------------------------------------------------------------------------
// localStorage persistence. Per-device only — no accounts, no server storage.
// Every accessor is guarded so it is safe to call during SSR / before hydration.
// -----------------------------------------------------------------------------

const KEYS = {
  age: "mathhelper.age",
  problems: "mathhelper.problems",
  chats: "mathhelper.chats",
  image: "mathhelper.image",
  // --- Teach-back (Teach Zeb) additions ---
  solved: "mathhelper.solved",
  teachbacks: "mathhelper.teachbacks",
  scrapbook: "mathhelper.scrapbook",
  accessoriesUnlocked: "mathhelper.accessoriesUnlocked",
  accessorySelected: "mathhelper.accessorySelected",
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

// -----------------------------------------------------------------------------
// Teach-back (Teach Zeb) persistence. All reads default missing/old data to
// empty so the app never crashes on data saved by an earlier version.
// -----------------------------------------------------------------------------

/** Ids of problems the tutor has confirmed correct (kept as a de-duped list). */
export function loadSolved(): string[] {
  const value = readJSON<unknown[]>(KEYS.solved, []);
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function saveSolved(ids: string[]): void {
  writeJSON(KEYS.solved, Array.from(new Set(ids)));
}

/** A persisted teach-back session: the visible chat plus meter/done state. */
export interface TeachbackSession {
  history: ChatMessage[];
  understanding: number;
  gotIt: boolean;
}

export type TeachbackMap = Record<string, TeachbackSession>;

function normalizeSession(raw: unknown): TeachbackSession {
  const s = (raw ?? {}) as Record<string, unknown>;
  const history = Array.isArray(s.history)
    ? (s.history as unknown[])
        .filter(
          (m): m is ChatMessage =>
            typeof m === "object" &&
            m !== null &&
            ((m as { role?: unknown }).role === "user" ||
              (m as { role?: unknown }).role === "assistant") &&
            typeof (m as { content?: unknown }).content === "string"
        )
        .map((m) => ({ role: m.role, content: m.content }))
    : [];
  const understanding =
    typeof s.understanding === "number" && Number.isFinite(s.understanding)
      ? Math.max(0, Math.min(100, Math.round(s.understanding)))
      : 0;
  return { history, understanding, gotIt: s.gotIt === true };
}

export function loadTeachbacks(): TeachbackMap {
  const value = readJSON<Record<string, unknown>>(KEYS.teachbacks, {});
  if (!value || typeof value !== "object") return {};
  const out: TeachbackMap = {};
  for (const [id, raw] of Object.entries(value)) {
    out[id] = normalizeSession(raw);
  }
  return out;
}

export function saveTeachbacks(map: TeachbackMap): void {
  writeJSON(KEYS.teachbacks, map);
}

/** Zeb's Scrapbook — a growing keepsake of everything the student taught him. */
export function loadScrapbook(): ScrapbookEntry[] {
  const value = readJSON<unknown[]>(KEYS.scrapbook, []);
  if (!Array.isArray(value)) return [];
  return value
    .map((raw): ScrapbookEntry | null => {
      const e = (raw ?? {}) as Record<string, unknown>;
      const scrapbookLine =
        typeof e.scrapbookLine === "string" ? e.scrapbookLine : "";
      if (!scrapbookLine) return null;
      return {
        problemLabel:
          typeof e.problemLabel === "string" ? e.problemLabel : "A problem",
        date: typeof e.date === "string" ? e.date : "",
        scrapbookLine,
      };
    })
    .filter((e): e is ScrapbookEntry => e !== null);
}

export function saveScrapbook(entries: ScrapbookEntry[]): void {
  writeJSON(KEYS.scrapbook, entries);
}

/** How many cosmetic accessories are unlocked (0…ACCESSORIES.length). */
export function loadUnlockedCount(): number {
  const value = readJSON<number>(KEYS.accessoriesUnlocked, 0);
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(ACCESSORIES.length, Math.floor(value)));
}

export function saveUnlockedCount(count: number): void {
  writeJSON(
    KEYS.accessoriesUnlocked,
    Math.max(0, Math.min(ACCESSORIES.length, Math.floor(count)))
  );
}

/** The accessory id the student has chosen for the companion, or null. */
export function loadSelectedAccessory(): string | null {
  const value = readJSON<string | null>(KEYS.accessorySelected, null);
  return typeof value === "string" && value ? value : null;
}

export function saveSelectedAccessory(id: string | null): void {
  if (id === null) {
    if (!canUseStorage()) return;
    try {
      window.localStorage.removeItem(KEYS.accessorySelected);
    } catch {
      // ignore
    }
    return;
  }
  writeJSON(KEYS.accessorySelected, id);
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
