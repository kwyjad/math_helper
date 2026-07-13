"use client";

import { useState } from "react";
import type { Problem } from "../lib/types";
import MathText from "./MathText";

function hasUnclear(problem: Problem): boolean {
  return (
    problem.text.includes("[unclear]") || problem.latex.includes("[unclear]")
  );
}

function ProblemRow({
  problem,
  index,
  onSelect,
  onEdit,
}: {
  problem: Problem;
  index: number;
  onSelect: () => void;
  onEdit: (next: Problem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(problem.text);
  const [latex, setLatex] = useState(problem.latex);

  function save() {
    onEdit({ ...problem, text, latex });
    setEditing(false);
  }

  function cancel() {
    setText(problem.text);
    setLatex(problem.latex);
    setEditing(false);
  }

  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-text-muted">
          {problem.label ? `Problem ${problem.label}` : `Problem ${index + 1}`}
        </span>
        {hasUnclear(problem) && (
          <span className="rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">
            needs review
          </span>
        )}
      </div>

      {editing ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`text-${problem.id}`}
              className="text-sm font-medium"
            >
              Problem text
            </label>
            <textarea
              id={`text-${problem.id}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`latex-${problem.id}`}
              className="text-sm font-medium"
            >
              Math (LaTeX)
            </label>
            <textarea
              id={`latex-${problem.id}`}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              rows={2}
              spellCheck={false}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-contrast transition-opacity hover:opacity-90"
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-md border border-border px-4 py-2 font-medium transition-colors hover:border-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-2 text-text">
            <MathText>{problem.text}</MathText>
          </div>
          {problem.latex && (
            <div className="mt-2 text-text">
              <MathText>{problem.latex}</MathText>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSelect}
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-contrast transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              Work on this
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md border border-border px-4 py-2 font-medium transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              Edit
            </button>
          </div>
        </>
      )}
    </li>
  );
}

export default function ProblemList({
  problems,
  age,
  onSelect,
  onEdit,
  onAddMore,
  onChangeAge,
  onReset,
}: {
  problems: Problem[];
  age: number | null;
  onSelect: (id: string) => void;
  onEdit: (next: Problem) => void;
  onAddMore: () => void;
  onChangeAge: () => void;
  onReset: () => void;
}) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Your problems</h1>
          {age != null && (
            <button
              type="button"
              onClick={onChangeAge}
              className="text-sm text-text-muted underline underline-offset-2 hover:text-text"
            >
              Age: {age} (change)
            </button>
          )}
        </div>
        <p className="text-text-muted">
          Pick one to start. Tap{" "}
          <span className="font-medium text-text">Edit</span> to fix anything
          that was read wrong.
        </p>
      </header>

      {problems.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-text-muted">
          No problems yet. Upload a photo to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {problems.map((problem, index) => (
            <ProblemRow
              key={problem.id}
              problem={problem}
              index={index}
              onSelect={() => onSelect(problem.id)}
              onEdit={onEdit}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={onAddMore}
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-contrast transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          Add or replace problems
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-border px-4 py-2 font-medium text-error transition-colors hover:border-error focus:outline-none focus:ring-2 focus:ring-error/40"
        >
          Reset everything
        </button>
      </div>
    </section>
  );
}
