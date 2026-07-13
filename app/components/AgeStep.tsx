"use client";

import { useState } from "react";
import { COMPANIONS, type CompanionChoice } from "../lib/companions";

interface PickerOption {
  id: CompanionChoice;
  title: string;
  blurb: string;
  /** Character art for the card, or null for the "None" option. */
  image: string | null;
  /** Glyph shown when there's no art. */
  emoji: string;
}

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

  const options: PickerOption[] = [
    {
      id: "zeb",
      title: `${COMPANIONS.zeb.name} ${COMPANIONS.zeb.species}`,
      blurb: COMPANIONS.zeb.blurb,
      image: COMPANIONS.zeb.pickerImage,
      emoji: COMPANIONS.zeb.emoji,
    },
    {
      id: "loftus",
      title: `${COMPANIONS.loftus.name} ${COMPANIONS.loftus.species}`,
      blurb: COMPANIONS.loftus.blurb,
      image: COMPANIONS.loftus.pickerImage,
      emoji: COMPANIONS.loftus.emoji,
    },
    {
      id: "none",
      title: "None",
      blurb: "Just the tutor, no characters.",
      image: null,
      emoji: "∑",
    },
  ];

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-8">
      <div className="flex flex-col gap-3 text-center">
        <h1 className="font-heading text-3xl font-bold">
          Welcome to Math Helper
        </h1>
        <p className="text-text-muted">
          Work through your homework one problem at a time — with a little help.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="age" className="font-medium">
            How old are you?
          </label>
          <p className="text-sm text-text-muted">
            This helps the tutor pitch things just right.
          </p>
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
            className="w-full rounded-md border border-border bg-surface px-4 py-3 text-lg shadow-soft outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
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

        <fieldset className="flex flex-col gap-3">
          <legend className="font-medium">
            Pick a companion{" "}
            <span className="font-normal text-text-muted">(optional)</span>
          </legend>
          <p className="text-sm text-text-muted">
            After you solve a problem, you can teach it to a companion — a fun
            way to lock it in. Change or remove this any time.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {options.map((opt) => {
              const selected = character === opt.id;
              return (
                <label
                  key={opt.id}
                  className={`press group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border bg-surface p-4 text-center transition-all ${
                    selected
                      ? "border-primary shadow-lifted ring-2 ring-primary/30"
                      : "border-border shadow-soft hover:border-primary hover:shadow-lifted"
                  }`}
                >
                  <input
                    type="radio"
                    name="companion"
                    value={opt.id}
                    checked={selected}
                    onChange={() => setCharacter(opt.id)}
                    className="sr-only"
                  />
                  <div
                    className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg"
                    style={{ background: "var(--bust-bg)" }}
                  >
                    {opt.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={opt.image}
                        alt={opt.title}
                        className="h-full w-full object-contain object-bottom"
                        draggable={false}
                      />
                    ) : (
                      <span
                        className="font-heading text-6xl font-bold text-primary/50"
                        aria-hidden
                      >
                        {opt.emoji}
                      </span>
                    )}
                  </div>
                  <span className="font-heading text-base font-semibold">
                    {opt.title}
                  </span>
                  <span className="text-sm text-text-muted">{opt.blurb}</span>
                  {selected && (
                    <span
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-sm text-primary-contrast shadow-soft"
                      aria-hidden
                    >
                      ✓
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>

        <button
          type="submit"
          className="press w-full rounded-md bg-primary px-4 py-3 text-lg font-medium text-primary-contrast shadow-soft transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          Continue
        </button>
      </form>
    </section>
  );
}
