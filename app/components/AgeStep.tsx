"use client";

import { useState } from "react";
import { COMPANION_LIST, type CompanionChoice } from "../lib/companions";

export default function AgeStep({
  initialAge,
  initialCharacter,
  onSubmit,
}: {
  initialAge: number | null;
  initialCharacter: CompanionChoice;
  onSubmit: (age: number, character: CompanionChoice) => void;
}) {
  const [value, setValue] = useState(
    initialAge != null ? String(initialAge) : ""
  );
  const [character, setCharacter] = useState<CompanionChoice>(initialCharacter);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const age = Number(value);
    if (!Number.isFinite(age) || age < 4 || age > 100) {
      setError("Please enter your age (a number between 4 and 100).");
      return;
    }
    setError(null);
    onSubmit(Math.round(age), character);
  }

  const options: { id: CompanionChoice; title: string; blurb: string; emoji: string }[] =
    [
      ...COMPANION_LIST.map((c) => ({
        id: c.id as CompanionChoice,
        title: `${c.name} ${c.species}`,
        blurb: c.blurb,
        emoji: c.emoji,
      })),
      {
        id: "none",
        title: "None",
        blurb: "Just the tutor, no characters.",
        emoji: "📘",
      },
    ];

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Welcome to Math Helper</h1>
        <p className="text-text-muted">
          Work through your homework one problem at a time. First, how old are
          you? This helps the tutor pitch things just right.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="age" className="font-medium">
            Your age
          </label>
          <input
            id="age"
            name="age"
            type="number"
            inputMode="numeric"
            min={4}
            max={100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            className="w-full rounded-md border border-border bg-surface px-4 py-3 text-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            placeholder="e.g. 14"
            aria-describedby={error ? "age-error" : undefined}
            aria-invalid={error ? true : undefined}
          />
          {error && (
            <p id="age-error" className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">
            Pick a companion{" "}
            <span className="font-normal text-text-muted">(optional)</span>
          </legend>
          <p className="mb-1 text-sm text-text-muted">
            After you solve a problem, you can teach it to a companion — a fun
            way to lock it in. You can change or remove this any time.
          </p>
          <div className="flex flex-col gap-2">
            {options.map((opt) => {
              const selected = character === opt.id;
              return (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    selected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-border hover:border-primary"
                  }`}
                >
                  <input
                    type="radio"
                    name="companion"
                    value={opt.id}
                    checked={selected}
                    onChange={() => setCharacter(opt.id)}
                    className="mt-1"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">
                      <span aria-hidden>{opt.emoji} </span>
                      {opt.title}
                    </span>
                    <span className="text-sm text-text-muted">{opt.blurb}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 py-3 text-lg font-medium text-primary-contrast transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          Continue
        </button>
      </form>
    </section>
  );
}
