"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Problem, TeachbackResponse } from "../lib/types";
import type { StoredImage, TeachbackSession } from "../lib/storage";
import type { Accessory } from "../lib/accessories";
import { type Companion, levelFor } from "../lib/companions";
import MathText from "./MathText";
import { OptionsList, TableBlock } from "./ProblemExtras";

function Meter({
  companion,
  progress,
  done,
}: {
  companion: Companion;
  progress: number;
  done: boolean;
}) {
  const level = levelFor(progress, done);
  const band = companion.bands[level];
  const pct = done ? 100 : Math.max(0, Math.min(100, progress));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-text-muted">{companion.meterTitle}</span>
        <span className={`font-semibold ${band.text}`}>{band.label}</span>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-bg"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={companion.meterTitle}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${band.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Avatar({
  companion,
  progress,
  done,
  accessory,
}: {
  companion: Companion;
  progress: number;
  done: boolean;
  accessory: Accessory | null;
}) {
  const level = levelFor(progress, done);
  const mood = companion.moods[level];
  return (
    <div className="flex items-center gap-4">
      <div
        className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-surface text-4xl ring-4 ${mood.ring} ${
          level === 3 ? "animate-bounce" : ""
        }`}
        aria-label={`${companion.name}: ${mood.caption}`}
        title={mood.caption}
      >
        <span aria-hidden>{companion.emoji}</span>
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
        <span className="text-lg font-semibold">{companion.name}</span>
        <span className="text-sm text-text-muted">
          <span aria-hidden>{mood.face} </span>
          {mood.caption}
        </span>
      </div>
    </div>
  );
}

export default function TeachbackView({
  companion,
  problem,
  index,
  age,
  image,
  session,
  onSessionChange,
  accessory,
  onDone,
  onExit,
}: {
  companion: Companion;
  problem: Problem;
  index: number;
  age: number;
  image: StoredImage | null;
  session: TeachbackSession;
  onSessionChange: (next: TeachbackSession) => void;
  accessory: Accessory | null;
  onDone: (scrapbookLine: string) => void;
  onExit: () => void;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openerRequested = useRef(false);

  const { history, progress, done } = session;
  const problemLabel = problem.label
    ? `Problem ${problem.label}`
    : `Problem ${index + 1}`;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history, loading]);

  // Fetch the companion's opener once when arriving at an empty session.
  useEffect(() => {
    if (history.length === 0 && !openerRequested.current) {
      openerRequested.current = true;
      void callCompanion([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function callCompanion(nextHistory: ChatMessage[]) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teachback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age,
          character: companion.id,
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
        setError(data?.error ?? `${companion.name} wandered off. Try again.`);
        return;
      }
      const reply = data as TeachbackResponse;
      const updatedHistory: ChatMessage[] = [
        ...nextHistory,
        { role: "assistant", content: reply.says },
      ];
      const becameDone = reply.done && !done;
      onSessionChange({
        history: updatedHistory,
        progress: reply.progress,
        done: done || reply.done,
        character: companion.id,
      });
      if (becameDone) {
        onDone(reply.scrapbookLine);
      }
    } catch {
      setError(`Couldn't reach ${companion.name}. Check your connection.`);
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
    onSessionChange({ ...session, history: nextHistory, character: companion.id });
    setInput("");
    void callCompanion(nextHistory);
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      {/* Header: avatar + always-visible cheerful exit */}
      <div className="flex items-start justify-between gap-3">
        <Avatar
          companion={companion}
          progress={progress}
          done={done}
          accessory={accessory}
        />
        <button
          type="button"
          onClick={onExit}
          className="shrink-0 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          title="Leave any time — no penalty."
        >
          Gotta go! 👋
        </button>
      </div>

      <Meter companion={companion} progress={progress} done={done} />

      {/* The problem in play, for reference */}
      <details className="rounded-lg border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold text-text-muted">
          {problemLabel} — the one in play
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

      {/* Chat */}
      <div
        ref={scrollRef}
        className="flex max-h-[45vh] min-h-40 flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-surface p-4"
      >
        {history.length === 0 && !loading && (
          <p className="text-text-muted">{companion.arriving}</p>
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
                  {companion.emoji} {companion.name}
                </span>
              )}
              <MathText>{msg.content}</MathText>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg rounded-bl-sm bg-bg px-4 py-2 text-text-muted">
              {companion.name} is thinking…
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}

      {done && (
        <div className="rounded-lg border border-success/40 bg-success/10 p-4 text-center">
          <p className="font-semibold text-success">{companion.doneBanner}</p>
          <button
            type="button"
            onClick={onExit}
            className="mt-3 rounded-md bg-primary px-5 py-2 font-medium text-primary-contrast transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            Back to problems
          </button>
        </div>
      )}

      {/* The chat input stays open even after done so the closing beat can play
          out and the student can reply. */}
      <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="teach-input" className="sr-only">
          Message {companion.name}
        </label>
        <input
          id="teach-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={companion.inputPlaceholder}
          disabled={loading}
          className="w-full rounded-md border border-border bg-surface px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-md bg-primary px-5 py-3 font-medium text-primary-contrast transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {companion.sendLabel}
        </button>
      </form>
    </section>
  );
}
