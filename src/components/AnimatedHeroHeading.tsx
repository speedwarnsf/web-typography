"use client";

import { useState, useEffect, useCallback } from "react";

const WORD = "Typography";
const LETTERS = WORD.split("");

const FONTS = [
  "var(--font-playfair)", "var(--font-inter)", "var(--font-source-sans)",
  "monospace", "serif", "sans-serif", "cursive",
  "Georgia", "Courier New", "Impact", "Times New Roman",
  "Palatino", "Garamond", "Trebuchet MS", "Arial Black",
];
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const VARIANTS = ["normal", "small-caps", "all-small-caps", "unicase"];
const COLORS = [
  "#B8963E", "#ff3333", "#ffffff", "#ffffff", "#ffffff", "#ffffff",
  "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff",
];

type LetterStyle = {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  rotate: number;
  skewX: number;
  scaleX: number;
  color: string;
  letterSpacing: number;
  fontStyle: string;
  fontVariantCaps: string;
};

const RESOLVED: LetterStyle = {
  fontFamily: "var(--font-playfair)",
  fontWeight: 700,
  fontSize: 1,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  color: "#ffffff",
  letterSpacing: 0,
  fontStyle: "normal",
  fontVariantCaps: "normal",
};

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const REGULARITY = 0.73;
const TICK_MS = 140;

function randomStyle(devOverride?: number): LetterStyle {
  const dev = devOverride !== undefined ? devOverride : (1 - REGULARITY);
  if (dev < 0.02) return RESOLVED;
  return {
    fontFamily: dev > 0.2 ? pick(FONTS) : RESOLVED.fontFamily,
    fontWeight: dev > 0.1 ? pick(WEIGHTS) : RESOLVED.fontWeight,
    // Clamp fontSize to prevent overflow on mobile
    fontSize: Math.max(0.5, Math.min(1.3, lerp(1, 0.3 + Math.random() * 1.4, dev))),
    rotate: lerp(0, (Math.random() - 0.5) * 40, dev), // Reduced from 60
    skewX: lerp(0, (Math.random() - 0.5) * 20, dev),  // Reduced from 30
    scaleX: Math.max(0.6, Math.min(1.4, lerp(1, 0.5 + Math.random() * 1.5, dev))), // Clamped
    color: dev > 0.05 ? pick(COLORS) : RESOLVED.color,
    letterSpacing: lerp(0, (Math.random() - 0.5) * 4, dev), // Reduced from 8
    fontStyle: dev > 0.3 && Math.random() > 0.6 ? "italic" : "normal",
    fontVariantCaps: dev > 0.4 ? pick(VARIANTS) : "normal",
  };
}

export default function AnimatedHeroHeading() {
  const [states, setStates] = useState<LetterStyle[]>(LETTERS.map(() => RESOLVED));
  const [phase, setPhase] = useState<"chaos" | "resolving" | "hold">("hold");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let t = 0;
    const iv = setInterval(() => {
      t++;
      setTick(t);

      const cycleLength = 55;
      const pos = t % cycleLength;

      if (pos < 15) {
        setPhase("hold");
      } else if (pos < 40) {
        setPhase("chaos");
      } else {
        setPhase("resolving");
      }
    }, TICK_MS);
    return () => clearInterval(iv);
  }, []);

  const getStyles = useCallback(() => {
    const cycleLength = 55;
    const pos = tick % cycleLength;

    if (pos < 15) {
      return LETTERS.map(() => RESOLVED);
    } else if (pos < 40) {
      return LETTERS.map(() => randomStyle());
    } else {
      const resolveProgress = (pos - 40) / (cycleLength - 40);
      return LETTERS.map((_, i) => {
        const letterPhase = ((i * 3 + 2) % LETTERS.length) / LETTERS.length;
        const letterProgress = Math.min(1, resolveProgress * (0.5 + letterPhase * 1.0));
        const entropy = (1 - REGULARITY) * (1 - letterProgress);
        return randomStyle(entropy);
      });
    }
  }, [tick]);

  useEffect(() => {
    setStates(getStyles());
  }, [getStyles]);

  return (
    <h1
      data-no-typeset
      className="text-[2.75rem] sm:text-7xl md:text-8xl lg:text-9xl font-bold tracking-tight leading-[0.95] mb-8"
      style={{
        minHeight: "1.1em",
        paddingBottom: "0.3em",
        /* Contain the chaos animation — prevent horizontal overflow */
        overflow: "hidden",
        /* Don't let touch events on the animation interfere with scrolling */
        touchAction: "pan-y",
        /* Prevent accidental text selection of invisible spacer letters */
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      aria-label="Web Typography"
    >
      <span style={{ fontFamily: "var(--font-playfair)", color: "#ffffff" }}>Web</span>
      <br />
      <span
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          whiteSpace: "nowrap",
          /* Extra safety: clip any letters that escape bounds */
          overflow: "hidden",
          /* Promote to GPU layer for smoother animation */
          willChange: "contents",
        }}
      >
        {LETTERS.map((letter, i) => {
          const s = states[i] || RESOLVED;
          const isResolved = phase === "hold";
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                fontFamily: "var(--font-playfair)",
                fontWeight: 700,
                fontSize: "1em",
                color: "transparent",
                lineHeight: 1,
                position: "relative",
                letterSpacing: "0px",
                overflow: "hidden",
              }}
            >
              {letter}
              <span
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  display: "inline-block",
                  fontFamily: s.fontFamily,
                  fontWeight: s.fontWeight,
                  fontSize: `${s.fontSize}em`,
                  fontStyle: s.fontStyle,
                  fontVariantCaps: s.fontVariantCaps as "normal" | "small-caps",
                  color: s.color,
                  transform: `translate(-50%, -50%) rotate(${s.rotate}deg) skewX(${s.skewX}deg) scaleX(${s.scaleX})`,
                  transition: isResolved
                    ? "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)"
                    : "all 0.06s linear",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}
                aria-hidden="true"
              >
                {letter}
              </span>
            </span>
          );
        })}
      </span>
    </h1>
  );
}
