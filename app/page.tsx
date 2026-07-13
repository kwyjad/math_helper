"use client";

import { useEffect, useState } from "react";
import AgeStep from "./components/AgeStep";
import UploadStep from "./components/UploadStep";
import ProblemList from "./components/ProblemList";
import TutorView from "./components/TutorView";
import TeachbackView from "./components/TeachbackView";
import Scrapbook from "./components/Scrapbook";
import type { ChatMessage, Problem, ScrapbookEntry } from "./lib/types";
import { ACCESSORIES, findAccessory } from "./lib/accessories";
import {
  getCompanion,
  type CompanionChoice,
  type CompanionId,
} from "./lib/companions";
import {
  clearAll,
  loadAge,
  loadCharacter,
  loadChats,
  loadImage,
  loadProblems,
  loadScrapbook,
  loadSelectedAccessory,
  loadSolved,
  loadTeachbacks,
  loadUnlockedCount,
  saveAge,
  saveCharacter,
  saveChats,
  saveImage,
  saveProblems,
  saveScrapbook,
  saveSelectedAccessory,
  saveSolved,
  saveTeachbacks,
  saveUnlockedCount,
  type ChatMap,
  type StoredImage,
  type TeachbackMap,
  type TeachbackSession,
} from "./lib/storage";

type Step = "age" | "upload" | "list" | "tutor" | "teach" | "scrapbook";

function emptySession(character: CompanionId): TeachbackSession {
  return { history: [], progress: 0, done: false, character };
}

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<Step>("age");
  const [age, setAge] = useState<number | null>(null);
  const [character, setCharacter] = useState<CompanionChoice>("zeb");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [chats, setChats] = useState<ChatMap>({});
  const [image, setImage] = useState<StoredImage | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // --- Teach-back (Teach Zeb) state ---
  const [solved, setSolved] = useState<string[]>([]);
  const [teachbacks, setTeachbacks] = useState<TeachbackMap>({});
  const [scrapbook, setScrapbook] = useState<ScrapbookEntry[]>([]);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [selectedAccessory, setSelectedAccessory] = useState<string | null>(null);

  // --- Hydrate from localStorage once on mount ---
  useEffect(() => {
    const storedAge = loadAge();
    const storedProblems = loadProblems();
    setAge(storedAge);
    setCharacter(loadCharacter());
    setProblems(storedProblems);
    setChats(loadChats());
    setImage(loadImage());
    setSolved(loadSolved());
    setTeachbacks(loadTeachbacks());
    setScrapbook(loadScrapbook());
    setUnlockedCount(loadUnlockedCount());
    setSelectedAccessory(loadSelectedAccessory());
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

  useEffect(() => {
    if (hydrated) saveSolved(solved);
  }, [solved, hydrated]);

  useEffect(() => {
    if (hydrated) saveTeachbacks(teachbacks);
  }, [teachbacks, hydrated]);

  useEffect(() => {
    if (hydrated) saveScrapbook(scrapbook);
  }, [scrapbook, hydrated]);

  useEffect(() => {
    if (hydrated) saveUnlockedCount(unlockedCount);
  }, [unlockedCount, hydrated]);

  useEffect(() => {
    if (hydrated) saveSelectedAccessory(selectedAccessory);
  }, [selectedAccessory, hydrated]);

  function handleAge(nextAge: number, nextCharacter: CompanionChoice) {
    setAge(nextAge);
    saveAge(nextAge);
    setCharacter(nextCharacter);
    saveCharacter(nextCharacter);
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

  function handleSolved(id: string) {
    setSolved((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function handleTeach(id: string) {
    setSelectedId(id);
    setStep("teach");
  }

  function handleSessionChange(id: string, next: TeachbackSession) {
    setTeachbacks((prev) => ({ ...prev, [id]: next }));
  }

  /**
   * A successful teach/catch: record a Scrapbook page and unlock the next
   * accessory. Deduped by the session's `done` flag (which stays true once set),
   * so re-entering a completed session can't double-count.
   */
  function handleDone(
    problem: Problem,
    companionId: CompanionId,
    scrapbookLine: string
  ) {
    const label = problem.label
      ? `Problem ${problem.label}`
      : `Problem ${problems.findIndex((p) => p.id === problem.id) + 1}`;
    setScrapbook((prev) => [
      ...prev,
      {
        character: companionId,
        problemLabel: label,
        date: new Date().toISOString(),
        scrapbookLine,
      },
    ]);
    setUnlockedCount((prev) => {
      const next = Math.min(ACCESSORIES.length, prev + 1);
      // Auto-equip the newly unlocked accessory the first time so the student
      // immediately sees Zeb wearing their reward.
      if (next > prev) {
        setSelectedAccessory((cur) => cur ?? ACCESSORIES[next - 1].id);
      }
      return next;
    });
  }

  function handleReset() {
    const ok = window.confirm(
      "This will erase your age, your problems, chats, and Zeb's Scrapbook on this device. Continue?"
    );
    if (!ok) return;
    clearAll();
    setAge(null);
    setCharacter("zeb");
    setProblems([]);
    setChats({});
    setImage(null);
    setSelectedId(null);
    setSolved([]);
    setTeachbacks({});
    setScrapbook([]);
    setUnlockedCount(0);
    setSelectedAccessory(null);
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
  // The chosen companion, or null when "None" — the top-level opt-out that hides
  // every teach-back entry point (the app is then just the tutor).
  const companion = getCompanion(character);
  const companionLabel = companion ? companion.name : "No companion";

  // Reuse a stored teach-back session only if it belongs to the current
  // companion; switching companions starts that problem's session fresh.
  const selectedSession =
    companion && selectedProblem
      ? teachbacks[selectedProblem.id]?.character === companion.id
        ? teachbacks[selectedProblem.id]
        : emptySession(companion.id)
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      {step === "age" && (
        <AgeStep
          initialAge={age}
          initialCharacter={character}
          onSubmit={handleAge}
        />
      )}

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
          companion={companion}
          companionLabel={companionLabel}
          solved={solved}
          scrapbookCount={scrapbook.length}
          onSelect={handleSelect}
          onEdit={handleEditProblem}
          onTeach={handleTeach}
          onOpenScrapbook={() => setStep("scrapbook")}
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
          companion={companion}
          solved={solved.includes(selectedProblem.id)}
          onSolved={() => handleSolved(selectedProblem.id)}
          onTeach={() => handleTeach(selectedProblem.id)}
        />
      )}

      {step === "teach" && companion && selectedProblem && selectedSession &&
        age != null && (
          <TeachbackView
            companion={companion}
            problem={selectedProblem}
            index={selectedIndex}
            age={age}
            image={image}
            session={selectedSession}
            onSessionChange={(next) =>
              handleSessionChange(selectedProblem.id, next)
            }
            accessory={findAccessory(selectedAccessory)}
            onDone={(line) => handleDone(selectedProblem, companion.id, line)}
            onExit={() => setStep("list")}
          />
        )}

      {step === "scrapbook" && (
        <Scrapbook
          entries={scrapbook}
          unlockedCount={unlockedCount}
          selectedAccessory={selectedAccessory}
          onSelectAccessory={setSelectedAccessory}
          onBack={() => setStep("list")}
        />
      )}

      {((step === "tutor" && !selectedProblem) ||
        (step === "teach" && (!selectedProblem || !companion))) && (
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
