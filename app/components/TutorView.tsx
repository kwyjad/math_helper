"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Problem } from "../lib/types";
import type { StoredImage } from "../lib/storage";
import { prepareImage } from "../lib/image";
import MathText from "./MathText";
import { OptionsList, TableBlock } from "./ProblemExtras";

export default function TutorView({
  problem,
  index,
  age,
  image,
  history,
  onHistoryChange,
  onBack,
  companionEnabled = false,
  solved = false,
  onSolved,
  onTeach,
}: {
  problem: Problem;
  index: number;
  age: number;
  image: StoredImage | null;
  history: ChatMessage[];
  onHistoryChange: (next: ChatMessage[]) => void;
  onBack: () => void;
  /** Whether a companion is chosen (teach-back offered at all). */
  companionEnabled?: boolean;
  /** Whether this problem has already been solved (retains a teach button). */
  solved?: boolean;
  /** Called when the tutor confirms a correct answer. */
  onSolved?: () => void;
  /** Called to open the teach-back view for this problem. */
  onTeach?: () => void;
}) {
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [answerPreview, setAnswerPreview] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Optional teach-back invitation, shown right after a correct answer.
  const [showInvite, setShowInvite] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isMultipleChoice = problem.options.length > 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history, loading]);

  async function callTutor(
    nextHistory: ChatMessage[],
    mode: "hint" | "check",
    submittedAnswer?: string,
    answerImage?: { base64: string; mimeType: string }
  ) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tutor", {
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
          mode,
          submittedAnswer,
          answerImage: answerImage?.base64,
          answerImageMimeType: answerImage?.mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      onHistoryChange([
        ...nextHistory,
        { role: "assistant", content: data.reply as string },
      ]);
      // If the tutor confirmed a correct answer, mark it solved and (when a
      // companion is chosen) surface the optional teach-back invitation.
      if (mode === "check" && data.correct === true) {
        onSolved?.();
        if (companionEnabled) setShowInvite(true);
      }
    } catch {
      setError("Couldn't reach the tutor. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  function sendHint(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const nextHistory: ChatMessage[] = [
      ...history,
      { role: "user", content: trimmed },
    ];
    onHistoryChange(nextHistory);
    setInput("");
    void callTutor(nextHistory, "hint");
  }

  function pickAnswerFile(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null;
    setError(null);
    setAnswerFile(chosen);
    setAnswerPreview(chosen ? URL.createObjectURL(chosen) : null);
  }

  function clearAnswerFile() {
    setAnswerFile(null);
    setAnswerPreview(null);
  }

  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = answer.trim();
    // Allow submitting a typed answer, an attached photo of their work, or both.
    if ((!trimmed && !answerFile) || loading) return;

    let prepared: { base64: string; mimeType: string } | undefined;
    if (answerFile) {
      try {
        prepared = await prepareImage(answerFile);
      } catch {
        setError("Couldn't read that image. Try another photo.");
        return;
      }
    }

    const label = trimmed
      ? answerFile
        ? `My answer: ${trimmed} (with a photo of my work)`
        : `My answer: ${trimmed}`
      : "My answer: (a photo of my work)";
    const nextHistory: ChatMessage[] = [
      ...history,
      { role: "user", content: label },
    ];
    onHistoryChange(nextHistory);
    setAnswer("");
    clearAnswerFile();
    setShowAnswer(false);
    void callTutor(nextHistory, "check", trimmed, prepared);
  }

  /** Submit a chosen multiple-choice letter (e.g. "C") to be checked. */
  function submitLetter(letter: string) {
    if (loading) return;
    const nextHistory: ChatMessage[] = [
      ...history,
      { role: "user", content: `My answer: ${letter}` },
    ];
    onHistoryChange(nextHistory);
    void callTutor(nextHistory, "check", letter);
  }

  const imageSrc = image ? `data:${image.mimeType};base64,${image.base64}` : null;

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          ← Back to list
        </button>
        <div className="flex items-center gap-2">
          {companionEnabled && solved && onTeach && (
            <button
              type="button"
              onClick={onTeach}
              className="rounded-md border border-accent px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              🦓 Teach Zeb
            </button>
          )}
          <span className="text-sm font-semibold text-text-muted">
            {problem.label ? `Problem ${problem.label}` : `Problem ${index + 1}`}
          </span>
        </div>
      </div>

      {/* Optional teach-back invitation after a correct answer. Easy to decline;
          declining or leaving never blocks anything. */}
      {companionEnabled && showInvite && onTeach && (
        <div className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">
            Nice work! Want to teach Zeb how you did it? 🦓
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowInvite(false);
                onTeach();
              }}
              className="rounded-md bg-accent px-4 py-2 font-medium text-primary-contrast transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              Let&apos;s go
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="rounded-md border border-border px-4 py-2 font-medium transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* The problem being worked on */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="text-text">
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

        {/* The page image — lets the student see the diagram/table and doubles
            as a check that the transcription matches the page. */}
        {imageSrc && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setImageExpanded((v) => !v)}
              className="block w-full text-left"
              aria-expanded={imageExpanded}
              title={imageExpanded ? "Tap to shrink" : "Tap to enlarge"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt="The page this problem came from"
                className={`w-auto rounded-md border border-border transition-all ${
                  imageExpanded ? "max-h-[70vh]" : "max-h-40"
                }`}
              />
            </button>
            <p className="mt-1 text-xs text-text-muted">
              {imageExpanded ? "Tap image to shrink" : "Tap image to enlarge"}
            </p>
          </div>
        )}
      </div>

      {/* Chat transcript */}
      <div
        ref={scrollRef}
        className="flex max-h-[45vh] min-h-40 flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-surface p-4"
      >
        {history.length === 0 && !loading && (
          <p className="text-text-muted">
            Stuck? Tell the tutor what you&apos;ve tried or what&apos;s confusing,
            and you&apos;ll get a hint — never the full answer.
          </p>
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
              <MathText>{msg.content}</MathText>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg rounded-bl-sm bg-bg px-4 py-2 text-text-muted">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}

      {/* Ask for a hint */}
      <form onSubmit={sendHint} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="hint-input" className="sr-only">
          Message the tutor
        </label>
        <input
          id="hint-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for a hint or share your thinking…"
          disabled={loading}
          className="w-full rounded-md border border-border bg-surface px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-md bg-primary px-5 py-3 font-medium text-primary-contrast transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>

      {/* Submit an answer to be checked */}
      {isMultipleChoice ? (
        // Multiple choice: tap a letter — nicer on a phone than typing.
        <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-surface p-4">
          <span className="font-medium">Check your answer</span>
          <p className="text-sm text-text-muted">
            Tap the letter you think is right — the tutor will tell you if
            you&apos;re on track, but never which letter is correct.
          </p>
          <div className="flex flex-wrap gap-2">
            {problem.options.map((option, i) => {
              const letter = option.letter || String.fromCharCode(65 + i);
              return (
                <button
                  key={`${letter}-${i}`}
                  type="button"
                  onClick={() => submitLetter(letter)}
                  disabled={loading}
                  className="min-w-12 rounded-md border border-accent px-4 py-3 text-lg font-semibold text-accent transition-colors hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      ) : showAnswer ? (
        <form
          onSubmit={submitAnswer}
          className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-surface p-4"
        >
          <label htmlFor="answer-input" className="font-medium">
            Submit an answer to check
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="answer-input"
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer…"
              disabled={loading}
              autoFocus
              className="w-full rounded-md border border-border bg-bg px-4 py-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || (!answer.trim() && !answerFile)}
              className="rounded-md bg-accent px-5 py-3 font-medium text-primary-contrast transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Check it
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAnswer(false);
                clearAnswerFile();
              }}
              disabled={loading}
              className="rounded-md border border-border px-4 py-3 font-medium transition-colors hover:border-primary disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          {/* Attach a photo/scan of work — for problems that need a drawing or
              handwritten steps the tutor should look at. */}
          {answerPreview ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={answerPreview}
                alt="Your attached work"
                className="max-h-24 w-auto rounded-md border border-border"
              />
              <button
                type="button"
                onClick={clearAnswerFile}
                disabled={loading}
                className="text-sm text-error underline underline-offset-2 disabled:opacity-50"
              >
                Remove photo
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* Take a new photo: on a phone or tablet this opens the camera
                  directly; on a computer with no camera it falls back to the
                  file picker. */}
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-bg px-4 py-2 text-sm font-medium transition-colors hover:border-accent">
                <span>📷 Take a photo</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={pickAnswerFile}
                  disabled={loading}
                  className="sr-only"
                />
              </label>
              {/* Choose an existing image: Windows folders, Apple Photos/Files
                  on iPhone/iPad, or the gallery/files on Android. No `capture`,
                  so the OS shows the full chooser. */}
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-bg px-4 py-2 text-sm font-medium transition-colors hover:border-accent">
                <span>🖼️ Choose a photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={pickAnswerFile}
                  disabled={loading}
                  className="sr-only"
                />
              </label>
            </div>
          )}
          <p className="text-xs text-text-muted">
            Drawing or working on paper? Snap a photo and the tutor will look at
            it.
          </p>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAnswer(true)}
          className="self-start rounded-md border border-accent px-4 py-2 font-medium text-accent transition-colors hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          I have an answer to check
        </button>
      )}
    </section>
  );
}
