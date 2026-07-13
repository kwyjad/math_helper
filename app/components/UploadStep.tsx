"use client";

import { useRef, useState } from "react";
import type { Problem } from "../lib/types";
import type { StoredImage } from "../lib/storage";
import { prepareImage } from "../lib/image";

export default function UploadStep({
  hasExistingProblems,
  onExtracted,
  onCancel,
}: {
  hasExistingProblems: boolean;
  /** replace = discard current list; append = add to it. */
  onExtracted: (
    problems: Problem[],
    mode: "replace" | "append",
    image: StoredImage
  ) => void;
  onCancel?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"replace" | "append">(
    hasExistingProblems ? "append" : "replace"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null;
    setError(null);
    setNotice(null);
    setFile(chosen);
    setPreview(chosen ? URL.createObjectURL(chosen) : null);
  }

  async function handleUpload() {
    if (!file) {
      setError("Choose or take a photo first.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { base64, mimeType } = await prepareImage(file);
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      const problems = (data.problems ?? []) as Problem[];
      if (problems.length === 0) {
        setNotice(
          "No problems were found in that photo. Try a clearer picture of the page with the exercises."
        );
        return;
      }
      // Keep the (already-compressed) page image so figures/tables survive into
      // the tutoring step.
      onExtracted(problems, mode, { base64, mimeType });
    } catch {
      setError("Couldn't reach the server. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          {hasExistingProblems ? "Add or replace problems" : "Upload your problems"}
        </h1>
        <p className="text-text-muted">
          Take or upload a clear photo of the problems from your textbook or
          worksheet. We&apos;ll transcribe them so you can pick one to work on.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <label
          htmlFor="photo"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface px-4 py-10 text-center transition-colors hover:border-primary"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Selected page preview"
              className="max-h-64 w-auto rounded-md"
            />
          ) : (
            <>
              <span className="text-lg font-medium">Tap to choose a photo</span>
              <span className="text-sm text-text-muted">
                or take one with your camera
              </span>
            </>
          )}
          <input
            id="photo"
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="sr-only"
          />
        </label>

        {hasExistingProblems && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-medium">
              What should we do with these?
            </legend>
            <label className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
              <input
                type="radio"
                name="mode"
                value="append"
                checked={mode === "append"}
                onChange={() => setMode("append")}
                className="size-4 accent-primary"
              />
              <span>Add to my current list</span>
            </label>
            <label className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
              <input
                type="radio"
                name="mode"
                value="replace"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
                className="size-4 accent-primary"
              />
              <span>Replace my current list</span>
            </label>
          </fieldset>
        )}

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="text-sm text-text-muted" role="status">
            {notice}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleUpload}
            disabled={loading || !file}
            className="w-full rounded-md bg-primary px-4 py-3 text-lg font-medium text-primary-contrast transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Reading the page…" : "Transcribe problems"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="w-full rounded-md border border-border bg-surface px-4 py-3 text-lg font-medium transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 sm:w-auto"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
