"use client";

import { useEffect, useRef, useState } from "react";
import type { Accessory } from "../lib/accessories";
import { type Companion, characterImageFor } from "../lib/companions";

// -----------------------------------------------------------------------------
// The illustrated character bust that carries the teach-back mood. The active
// image is chosen from `progress`/`done` (see characterImageFor). Because the
// source images have slightly different head framing, a ~250ms cross-fade both
// looks lively and hides any positional jump. On a true `done`, a small
// scale-bounce flourish fires. Everything respects `prefers-reduced-motion`.
//
// This is presentation only — it derives its state from props and never changes
// tutor/teach-back logic.
// -----------------------------------------------------------------------------

/** One image layer that fades in over whatever was showing before it. */
interface Layer {
  key: number;
  src: string;
}

export default function CharacterBust({
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
  const src = characterImageFor(companion.art, progress, done);

  // Stacked layers: the newest sits on top and fades in; older layers are
  // pruned once the fade completes so the DOM stays a single image at rest.
  const [layers, setLayers] = useState<Layer[]>([{ key: 0, src }]);
  const nextKey = useRef(1);
  const prevSrc = useRef(src);

  // Track whether the user prefers reduced motion (snap instead of fade/pop).
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // When the resolved image changes, add a new top layer to cross-fade into.
  useEffect(() => {
    if (src === prevSrc.current) return;
    prevSrc.current = src;
    if (reduceMotion) {
      setLayers([{ key: nextKey.current++, src }]);
      return;
    }
    setLayers((cur) => [...cur, { key: nextKey.current++, src }]);
  }, [src, reduceMotion]);

  // After a layer finishes fading in, drop everything beneath it.
  function handleFadeEnd(key: number) {
    setLayers((cur) => {
      const idx = cur.findIndex((l) => l.key === key);
      if (idx <= 0) return cur;
      return cur.slice(idx);
    });
  }

  // Fire the celebration pop when we reach a true `done`.
  const [pop, setPop] = useState(false);
  const wasDone = useRef(done);
  useEffect(() => {
    if (done && !wasDone.current && !reduceMotion) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 650);
      return () => clearTimeout(t);
    }
    wasDone.current = done;
  }, [done, reduceMotion]);

  return (
    <div
      className={`relative mx-auto w-full max-w-[16rem] ${pop ? "bust-pop" : ""}`}
    >
      {/* Fixed-aspect stage with a gentle teal wash so the face sits in the
          same spot regardless of each image's framing. */}
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-xl shadow-soft ring-1 ring-border/60"
        style={{ background: "var(--bust-bg)" }}
      >
        {layers.map((layer, i) => {
          const isTop = i === layers.length - 1;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={layer.key}
              src={layer.src}
              alt={`${companion.name}`}
              // The first paint and reduced-motion swaps skip the fade class.
              className={`absolute inset-0 h-full w-full object-contain object-bottom ${
                isTop && layers.length > 1 && !reduceMotion ? "bust-fade" : ""
              }`}
              onAnimationEnd={
                isTop ? () => handleFadeEnd(layer.key) : undefined
              }
              draggable={false}
            />
          );
        })}

        {accessory && (
          <span
            className="absolute right-3 top-3 rounded-full bg-surface px-2 py-1 text-xl shadow-soft"
            title={accessory.label}
            aria-label={`wearing ${accessory.label}`}
          >
            {accessory.emoji}
          </span>
        )}
      </div>
    </div>
  );
}
