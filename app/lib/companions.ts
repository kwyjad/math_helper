// -----------------------------------------------------------------------------
// Companion definitions (client-side, UI only — the system prompts live
// server-side in gemini.ts). Two deliberately opposite dynamics:
//   • Zeb the zebra   — a humble learner you TEACH.
//   • Sir Loftus      — an arrogant know-it-all giraffe you CATCH.
// Both drive the same shared meter + avatar + chat from a single 0–100 score.
// -----------------------------------------------------------------------------

/** A real companion (excludes the top-level "none" opt-out). */
export type CompanionId = "zeb" | "loftus";

/** The stored choice, including the "None — just the tutor" opt-out. */
export type CompanionChoice = CompanionId | "none";

/** The four meter/mood levels, low → done. A single level drives both. */
export type CompanionLevel = 0 | 1 | 2 | 3;

/** Map a 0–100 score (+ done flag) onto one of the four levels. */
export function levelFor(progress: number, done: boolean): CompanionLevel {
  if (done || progress >= 100) return 3;
  if (progress >= 67) return 2;
  if (progress >= 34) return 1;
  return 0;
}

interface BandStyle {
  label: string;
  /** Tailwind text color utility for the band label. */
  text: string;
  /** Tailwind bg color utility for the meter fill. */
  bar: string;
}

interface MoodStyle {
  /** Placeholder face emoji (real art lands in the later styling pass). */
  face: string;
  caption: string;
  /** Tailwind ring color utility for the avatar. */
  ring: string;
}

export interface Companion {
  id: CompanionId;
  /** Display name, e.g. "Zeb" / "Sir Loftus". */
  name: string;
  /** Species tagline, e.g. "the zebra". */
  species: string;
  /** Placeholder avatar emoji. */
  emoji: string;
  /** One-line vibe shown in the start-screen picker. */
  blurb: string;
  /** Meter heading, e.g. "Zeb understands…". */
  meterTitle: string;
  /** Verb used on entry buttons, e.g. "Teach" / "Catch". */
  actionVerb: string;
  /** The optional post-solve invitation question, in-voice. */
  invite: string;
  /** Chat send-button label. */
  sendLabel: string;
  /** Chat input placeholder. */
  inputPlaceholder: string;
  /** Shown in the empty chat while the opener loads. */
  arriving: string;
  /** Past-tense scrapbook prefix, e.g. "Taught Zeb" / "Caught Sir Loftus". */
  scrapbookVerb: string;
  /** Celebration banner line shown on `done`. */
  doneBanner: string;
  /** Four meter bands, indexed by level (0 → 3). */
  bands: [BandStyle, BandStyle, BandStyle, BandStyle];
  /** Four mood art states, indexed by level (0 → 3). */
  moods: [MoodStyle, MoodStyle, MoodStyle, MoodStyle];
}

export const COMPANIONS: Record<CompanionId, Companion> = {
  zeb: {
    id: "zeb",
    name: "Zeb",
    species: "the zebra",
    emoji: "🦓",
    blurb: "A sweet, goofy zebra who's bad at math. You teach him.",
    meterTitle: "Zeb understands…",
    actionVerb: "Teach",
    invite: "Nice work! Want to teach Zeb how you did it? 🦓",
    sendLabel: "Teach",
    inputPlaceholder: "Explain it to Zeb in your own words…",
    arriving: "Zeb is trotting over…",
    scrapbookVerb: "Taught Zeb",
    doneBanner: "🎉 You taught Zeb! It's in his Scrapbook.",
    bands: [
      { label: "Totally Lost", text: "text-text-muted", bar: "bg-text-muted" },
      { label: "Ohhh, Maybe", text: "text-accent", bar: "bg-accent" },
      { label: "I Think I See It", text: "text-primary", bar: "bg-primary" },
      { label: "GOT IT!", text: "text-success", bar: "bg-success" },
    ],
    moods: [
      { face: "😵‍💫", caption: "…huh?", ring: "ring-text-muted/30" },
      { face: "🤔", caption: "hmmm…", ring: "ring-accent/40" },
      { face: "😃", caption: "ooh!", ring: "ring-primary/50" },
      { face: "🥳", caption: "YAHOO!", ring: "ring-success/60" },
    ],
  },
  loftus: {
    id: "loftus",
    name: "Sir Loftus",
    species: "the giraffe",
    emoji: "🦒",
    blurb:
      "A pompous know-it-all giraffe who's often hilariously wrong. You catch him.",
    meterTitle: "Sir Loftus is…",
    actionVerb: "Catch",
    invite: "Nice work! Want to catch Sir Loftus getting it wrong? 🦒",
    sendLabel: "Catch him",
    inputPlaceholder: "Spot his mistake and explain WHY it's wrong…",
    arriving: "Sir Loftus is looming over you…",
    scrapbookVerb: "Caught Sir Loftus",
    doneBanner: "🏆 You caught Sir Loftus! It's in the Scrapbook.",
    bands: [
      { label: "PEAK ARROGANCE", text: "text-error", bar: "bg-error" },
      { label: "RATTLED", text: "text-accent", bar: "bg-accent" },
      { label: "CRACKING", text: "text-primary", bar: "bg-primary" },
      { label: "...FINE, YOU WIN", text: "text-success", bar: "bg-success" },
    ],
    moods: [
      { face: "😎", caption: "Behold my genius.", ring: "ring-error/40" },
      { face: "😤", caption: "Preposterous!", ring: "ring-accent/40" },
      { face: "😰", caption: "I… hmm.", ring: "ring-primary/50" },
      { face: "😩", caption: "…fine. FINE.", ring: "ring-success/60" },
    ],
  },
};

/** All companions in picker order. */
export const COMPANION_LIST: Companion[] = [COMPANIONS.zeb, COMPANIONS.loftus];

/** Resolve a stored choice to a Companion, or null for "none"/unknown. */
export function getCompanion(choice: CompanionChoice | null): Companion | null {
  if (choice === "zeb" || choice === "loftus") return COMPANIONS[choice];
  return null;
}
