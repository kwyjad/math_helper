"use client";

import { useEffect, useState } from "react";
import AgeStep from "./components/AgeStep";
import UploadStep from "./components/UploadStep";
import ProblemList from "./components/ProblemList";
import TutorView from "./components/TutorView";
import type { ChatMessage, Problem } from "./lib/types";
import {
  clearAll,
  loadAge,
  loadChats,
  loadImage,
  loadProblems,
  saveAge,
  saveChats,
  saveImage,
  saveProblems,
  type ChatMap,
  type StoredImage,
} from "./lib/storage";

type Step = "age" | "upload" | "list" | "tutor";

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<Step>("age");
  const [age, setAge] = useState<number | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [chats, setChats] = useState<ChatMap>({});
  const [image, setImage] = useState<StoredImage | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // --- Hydrate from localStorage once on mount ---
  useEffect(() => {
    const storedAge = loadAge();
    const storedProblems = loadProblems();
    setAge(storedAge);
    setProblems(storedProblems);
    setChats(loadChats());
    setImage(loadImage());
    if (storedAge == null) {
      setStep("age");
    } else if (storedProblems.length === 0) {
      setStep("upload");
    } else {
      setStep("list");
    }
    setHydrated(true);
  }, []);

  // --- Persist on change (after hydration, so we never clobber stored data) ---
  useEffect(() => {
    if (hydrated) saveProblems(problems);
  }, [problems, hydrated]);

  useEffect(() => {
    if (hydrated) saveChats(chats);
  }, [chats, hydrated]);

  function handleAge(nextAge: number) {
    setAge(nextAge);
    saveAge(nextAge);
    setStep(problems.length === 0 ? "upload" : "list");
  }

  function handleExtracted(
    next: Problem[],
    mode: "replace" | "append",
    nextImage: StoredImage
  ) {
    // A single current image is kept for now; the latest upload becomes the
    // page image every problem in the list is tutored against.
    setImage(nextImage);
    saveImage(nextImage);
    if (mode === "replace") {
      setProblems(next);
      setChats({});
    } else {
      // Re-key appended problems so ids stay unique across uploads. Ids are
      // internal only (the list shows each problem's label or position), so a
      // simple monotonic counter is enough.
      const existingIds = new Set(problems.map((p) => p.id));
      let counter = problems.length;
      const appended = next.map((p) => {
        let id = p.id;
        while (existingIds.has(id)) {
          counter += 1;
          id = String(counter);
        }
        existingIds.add(id);
        return { ...p, id };
      });
      setProblems([...problems, ...appended]);
    }
    setStep("list");
  }

  function handleEditProblem(next: Problem) {
    setProblems((prev) => prev.map((p) => (p.id === next.id ? next : p)));
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    setStep("tutor");
  }

  function handleHistoryChange(id: string, next: ChatMessage[]) {
    setChats((prev) => ({ ...prev, [id]: next }));
  }

  function handleReset() {
    const ok = window.confirm(
      "This will erase your age, your problems, and all chats on this device. Continue?"
    );
    if (!ok) return;
    clearAll();
    setAge(null);
    setProblems([]);
    setChats({});
    setImage(null);
    setSelectedId(null);
    setStep("age");
  }

  // Avoid a hydration flash: render nothing until localStorage is read.
  if (!hydrated) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl items-center justify-center px-4 py-8">
        <p className="text-text-muted">Loading…</p>
      </main>
    );
  }

  const selectedIndex = problems.findIndex((p) => p.id === selectedId);
  const selectedProblem = selectedIndex >= 0 ? problems[selectedIndex] : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      {step === "age" && <AgeStep initialAge={age} onSubmit={handleAge} />}

      {step === "upload" && (
        <UploadStep
          hasExistingProblems={problems.length > 0}
          onExtracted={handleExtracted}
          onCancel={problems.length > 0 ? () => setStep("list") : undefined}
        />
      )}

      {step === "list" && (
        <ProblemList
          problems={problems}
          age={age}
          onSelect={handleSelect}
          onEdit={handleEditProblem}
          onAddMore={() => setStep("upload")}
          onChangeAge={() => setStep("age")}
          onReset={handleReset}
        />
      )}

      {step === "tutor" && selectedProblem && age != null && (
        <TutorView
          problem={selectedProblem}
          index={selectedIndex}
          age={age}
          image={image}
          history={chats[selectedProblem.id] ?? []}
          onHistoryChange={(next) =>
            handleHistoryChange(selectedProblem.id, next)
          }
          onBack={() => setStep("list")}
        />
      )}

      {step === "tutor" && !selectedProblem && (
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            onClick={() => setStep("list")}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-contrast"
          >
            Back to list
          </button>
        </div>
      )}
    </main>
  );
}
