"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Problem, TeachbackResponse } from "../lib/types";
import type { StoredImage, TeachbackSession } from "../lib/storage";
import type { Accessory } from "../lib/accessories";
import MathText from "./MathText";
import { OptionsList, TableBlock } from "./ProblemExtras";

// --- Meter bands, driven by `understanding` (0–100) / gotIt -------------------

type Band = { label: string; className: string };

function bandFor(understanding: number, gotIt: boolean): Band {
  if (gotIt || understanding >= 100) {
    return { label: "GOT IT!", className: "text-success" };
  }
  if (understanding >= 67) {
    return { label: "I Think I See It", className: "text-primary" };
  }
  if (understanding >= 34) {
    return { label: "Ohhh, Maybe", className: "text-accent" };
  }
  return { label: "Totally Lost", className: "text-text-muted" };
}

// --- Avatar mood states, driven by the same score ----------------------------

type Mood = "confused" | "thinking" | "delighted" | "celebrating";

function moodFor(understanding: number, gotIt: boolean): Mood {
  if (gotIt || understanding >= 100) return "celebrating";
  if (understanding >= 67) return "delighted";
  if (understanding >= 34) return "thinking";
  return "confused";
}

// Placeholder art: a face emoji + caption per mood. Real artwork lands in the
// later styling pass; these just have to switch correctly with the score.
const MOOD_ART: Record<Mood, { face: string; caption: string; ring: string }> = {
  confused: { face: "😵‍💫", caption: "…huh?", ring: "ring-text-muted/30" },
  thinking: { face: "🤔", caption: "hmmm…", ring: "ring-accent/40" },
  delighted: { face: "😃", caption: "ooh!", ring: "ring-primary/50" },
  celebrating: { face: "🥳", caption: "YAHOO!", ring: "ring-success/60" },
};

function UnderstandingMeter({
  understanding,
  gotIt,
}: {
  understanding: number;
  gotIt: boolean;
}) {
  const band = bandFor(understanding, gotIt);
  const pct = gotIt ? 100 : Math.max(0, Math.min(100, understanding));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-text-muted">Zeb understands…</span>
        <span className={`font-semibold ${band.className}`}>{band.label}</span>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-bg"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="How well Zeb understands"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            gotIt || pct >= 100
              ? "bg-success"
              : pct >= 67
              ? "bg-primary"
              : pct >= 34
              ? "bg-accent"
              : "bg-text-muted"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ZebAvatar({
  understanding,
  gotIt,
  accessory,
}: {
  understanding: number;
  gotIt: boolean;
  accessory: Accessory | null;
}) {
  const mood = moodFor(understanding, gotIt);
  const art = MOOD_ART[mood];
  return (
    <div className="flex items-center gap-4">
      <div
        className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-surface text-4xl ring-4 ${art.ring} ${
          mood === "celebrating" ? "animate-bounce" : ""
        }`}
        aria-label={`Zeb is ${mood}`}
        title={`Zeb is ${mood}`}
      >
        <span aria-hidden>🦓</span>
        {accessory && (
          <span
            className="absolute -right-1 -top-1 rounded-full bg-bg px-1 text-lg shadow-sm"
            title={accessory.label}
            aria-label={`wearing ${accessory.label}`}
          >
            {accessory.emoji}
          </span>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-semibold">Zeb</span>
        <span className="text-sm text-text-muted">
          <span aria-hidden>{art.face} </span>
          {art.caption}
        </span>
      </div>
    </div>
  );
}

export default function TeachZebView({
  problem,
  index,
  age,
  image,
  session,
  onSessionChange,
  accessory,
  onGotIt,
  onExit,
}: {
  problem: Problem;
  index: number;
  age: number;
  image: StoredImage | null;
  session: TeachbackSession;
  onSessionChange: (next: TeachbackSession) => void;
  accessory: Accessory | null;
  onGotIt: (scrapbookLine: string) => void;
  onExit: () => void;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openerRequested = useRef(false);

  const { history, understanding, gotIt } = session;
  const problemLabel = problem.label
    ? `Problem ${problem.label}`
    : `Problem ${index + 1}`;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history, loading]);

  // Fetch Zeb's opener once when arriving at an empty session.
  useEffect(() => {
    if (history.length === 0 && !openerRequested.current) {
      openerRequested.current = true;
      void callZeb([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function callZeb(nextHistory: ChatMessage[]) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teachback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age,
          problem: {
            text: problem.text,
            latex: problem.latex,
            options: problem.options,
            hasFigure: problem.hasFigure,
            figureDescription: problem.figureDescription,
            table: problem.table,
          },
          image: image?.base64,
          imageMimeType: image?.mimeType,
          history: nextHistory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Zeb wandered off. Try again.");
        return;
      }
      const reply = data as TeachbackResponse;
      const updatedHistory: ChatMessage[] = [
        ...nextHistory,
        { role: "assistant", content: reply.zebSays },
      ];
      const becameGotIt = reply.gotIt && !gotIt;
      onSessionChange({
        history: updatedHistory,
        understanding: reply.understanding,
        gotIt: gotIt || reply.gotIt,
      });
      if (becameGotIt) {
        onGotIt(reply.scrapbookLine);
      }
    } catch {
      setError("Couldn't reach Zeb. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const nextHistory: ChatMessage[] = [
      ...history,
      { role: "user", content: trimmed },
    ];
    onSessionChange({ ...session, history: nextHistory });
    setInput("");
    void callZeb(nextHistory);
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      {/* Header: avatar + always-visible cheerful exit */}
      <div className="flex items-start justify-between gap-3">
        <ZebAvatar
          understanding={understanding}
          gotIt={gotIt}
          accessory={accessory}
        />
        <button
          type="button"
          onClick={onExit}
          className="shrink-0 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          title="Leave any time — no penalty, Zeb waves goodbye."
        >
          Gotta go! 👋
        </button>
      </div>

      <UnderstandingMeter understanding={understanding} gotIt={gotIt} />

      {/* The problem being taught, for reference */}
      <details className="rounded-lg border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold text-text-muted">
          {problemLabel} — the one you&apos;re teaching
        </summary>
        <div className="mt-2 text-text">
          <MathText>{problem.text}</MathText>
        </div>
        {problem.latex && (
          <div className="mt-2 text-text">
            <MathText>{problem.latex}</MathText>
          </div>
        )}
        {problem.table && <TableBlock table={problem.table} />}
        {problem.hasFigure && problem.figureDescription && (
          <p className="mt-3 text-sm italic text-text-muted">
            Figure: {problem.figureDescription}
          </p>
        )}
        <OptionsList options={problem.options} />
      </details>

      {/* Chat with Zeb */}
      <div
        ref={scrollRef}
        className="flex max-h-[45vh] min-h-40 flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-surface p-4"
      >
        {history.length === 0 && !loading && (
          <p className="text-text-muted">Zeb is trotting over…</p>
        )}
        {history.map((msg, i) => (
          <div
            key={i}
            className={
              msg.role === "user" ? "flex justify-end" : "flex justify-start"
            }
          >
            <div
              className={
                msg.role === "user"
                  ? "max-w-[85%] rounded-lg rounded-br-sm bg-primary px-4 py-2 text-primary-contrast"
                  : "max-w-[85%] rounded-lg rounded-bl-sm bg-bg px-4 py-2 text-text"
              }
            >
              {msg.role === "assistant" && (
                <span className="mb-0.5 block text-xs font-semibold text-text-muted">
                  🦓 Zeb
                </span>
              )}
              <MathText>{msg.content}</MathText>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg rounded-bl-sm bg-bg px-4 py-2 text-text-muted">
              Zeb is thinking…
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}

      {gotIt && (
        <div className="rounded-lg border border-success/40 bg-success/10 p-4 text-center">
          <p className="font-semibold text-success">
            🎉 You taught Zeb! It&apos;s in his Scrapbook.
          </p>
          <button
            type="button"
            onClick={onExit}
            className="mt-3 rounded-md bg-primary px-5 py-2 font-medium text-primary-contrast transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            Back to problems
          </button>
        </div>
      )}

      {/* Teach Zeb — the chat input stays open even after gotIt so the capstone
          can play out and the student can reply. */}
      <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="zeb-input" className="sr-only">
          Explain it to Zeb
        </label>
        <input
          id="zeb-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Explain it to Zeb in your own words…"
          disabled={loading}
          className="w-full rounded-md border border-border bg-surface px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-md bg-primary px-5 py-3 font-medium text-primary-contrast transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Teach
        </button>
      </form>
    </section>
  );
}
