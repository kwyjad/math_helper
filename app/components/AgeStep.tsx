"use client";

import { useState } from "react";

export default function AgeStep({
  initialAge,
  onSubmit,
}: {
  initialAge: number | null;
  onSubmit: (age: number) => void;
}) {
  const [value, setValue] = useState(
    initialAge != null ? String(initialAge) : ""
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const age = Number(value);
    if (!Number.isFinite(age) || age < 4 || age > 100) {
      setError("Please enter your age (a number between 4 and 100).");
      return;
    }
    setError(null);
    onSubmit(Math.round(age));
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Welcome to Math Helper</h1>
        <p className="text-text-muted">
          Work through your homework one problem at a time. First, how old are
          you? This helps the tutor pitch things just right.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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
