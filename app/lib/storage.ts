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
} as const;

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

export function loadProblems(): Problem[] {
  const value = readJSON<Problem[]>(KEYS.problems, []);
  return Array.isArray(value) ? value : [];
}

export function saveProblems(problems: Problem[]): void {
  writeJSON(KEYS.problems, problems);
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
