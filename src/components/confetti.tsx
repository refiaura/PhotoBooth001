"use client";

import { useMemo } from "react";
import { Heart } from "./heart";

const PIECES = 28;

/** Hujan hati dan bulatan sekali jalan saat photostrip jadi. Otomatis diam bila reduced motion. */
export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 7) * 0.12,
        duration: 2.4 + ((i * 13) % 10) / 10,
        drift: `${((i * 29) % 60) - 30}vw`,
        spin: `${((i * 97) % 720) - 360}deg`,
        heart: i % 3 !== 0,
        size: 10 + ((i * 11) % 14),
        color: i % 2 === 0 ? "text-heart" : "text-sky",
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`absolute top-0 ${p.color}`}
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animation: `confetti-fall ${p.duration}s ${p.delay}s cubic-bezier(0.3, 0.6, 0.5, 1) forwards`,
              "--drift": p.drift,
              "--spin": p.spin,
              opacity: 0,
            } as React.CSSProperties
          }
        >
          {p.heart ? (
            <Heart className="size-full" />
          ) : (
            <span className="block size-full rounded-full bg-current" />
          )}
        </span>
      ))}
    </div>
  );
}
