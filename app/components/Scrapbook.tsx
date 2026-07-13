"use client";

import type { ScrapbookEntry } from "../lib/types";
import { ACCESSORIES, unlockedAccessories } from "../lib/accessories";

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Scrapbook({
  entries,
  unlockedCount,
  selectedAccessory,
  onSelectAccessory,
  onBack,
}: {
  entries: ScrapbookEntry[];
  unlockedCount: number;
  selectedAccessory: string | null;
  onSelectAccessory: (id: string | null) => void;
  onBack: () => void;
}) {
  const unlocked = unlockedAccessories(unlockedCount);
  const unlockedIds = new Set(unlocked.map((a) => a.id));
  // Newest first without mutating the source array.
  const ordered = [...entries].reverse();

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          ← Back
        </button>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">🦓 Zeb&apos;s Scrapbook</h1>
        <p className="text-text-muted">
          Everything you&apos;ve taught Zeb — a growing keepsake. Teach him a new
          method to add a page (and unlock a new accessory).
        </p>
      </header>

      {/* Wardrobe: pick from unlocked accessories */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Zeb&apos;s Wardrobe</h2>
          <span className="text-sm text-text-muted">
            {unlocked.length}/{ACCESSORIES.length} unlocked
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSelectAccessory(null)}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              selectedAccessory === null
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary"
            }`}
          >
            None
          </button>
          {ACCESSORIES.map((acc) => {
            const isUnlocked = unlockedIds.has(acc.id);
            const isSelected = selectedAccessory === acc.id;
            return (
              <button
                key={acc.id}
                type="button"
                disabled={!isUnlocked}
                onClick={() => onSelectAccessory(acc.id)}
                title={
                  isUnlocked
                    ? acc.label
                    : `${acc.label} — locked. Teach Zeb to unlock!`
                }
                className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : isUnlocked
                    ? "border-border hover:border-primary"
                    : "cursor-not-allowed border-border opacity-40"
                }`}
              >
                <span aria-hidden>{isUnlocked ? acc.emoji : "🔒"}</span>
                <span>{acc.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Entries */}
      {ordered.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-text-muted">
          No pages yet. Solve a problem, then tap{" "}
          <span className="font-medium text-text">Teach Zeb</span> to teach him
          how you did it — his first lesson will land here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ordered.map((entry, i) => (
            <li
              key={i}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-text-muted">
                  {entry.problemLabel}
                </span>
                {formatDate(entry.date) && (
                  <span className="text-xs text-text-muted">
                    {formatDate(entry.date)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-text">
                <span aria-hidden>🦓 </span>
                {entry.scrapbookLine}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
