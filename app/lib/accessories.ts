// -----------------------------------------------------------------------------
// A fixed, ordered list of silly cosmetic accessories. Each successful teach-back
// unlocks the NEXT one (by index). Placeholder visuals for now — a single emoji
// stands in for the eventual artwork; the unlock logic is what matters.
//
// This list is APPEND-ONLY: never reorder or remove entries, or previously
// unlocked/selected accessories saved in localStorage would shift meaning.
// -----------------------------------------------------------------------------

export interface Accessory {
  /** Stable id stored in localStorage. */
  id: string;
  /** Human-readable name shown in the wardrobe. */
  label: string;
  /** Placeholder emoji worn on the avatar until real art lands. */
  emoji: string;
}

export const ACCESSORIES: Accessory[] = [
  { id: "party-hat", label: "Party Hat", emoji: "🎉" },
  { id: "sunglasses", label: "Sunglasses", emoji: "🕶️" },
  { id: "bowtie", label: "Bowtie", emoji: "🎀" },
  { id: "top-hat", label: "Tiny Top Hat", emoji: "🎩" },
  { id: "cape", label: "Cape", emoji: "🦸" },
];

/** The accessory objects unlocked given a count, capped at the list length. */
export function unlockedAccessories(count: number): Accessory[] {
  const n = Math.max(0, Math.min(ACCESSORIES.length, Math.floor(count)));
  return ACCESSORIES.slice(0, n);
}

/** Look up an accessory by id, or null if it isn't a known id. */
export function findAccessory(id: string | null): Accessory | null {
  if (!id) return null;
  return ACCESSORIES.find((a) => a.id === id) ?? null;
}
