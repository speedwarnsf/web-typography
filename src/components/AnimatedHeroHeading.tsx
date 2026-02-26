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
// User-configured palette: mostly white with gold + red accent
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
  fontSize: 1, // 1 = multiplier of base size
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

const REGULARITY = 0.73; // 73% — subtle chaos
const TICK_MS = 200;     // glacial speed

function randomStyle(devOverride?: number): LetterStyle {
  const dev = devOverride !== undefined ? devOverride : (1 - REGULARITY);
  if (dev < 0.02) return RESOLVED;
  return {
    fontFamily: dev > 0.2 ? pick(FONTS) : RESOLVED.fontFamily,
    fontWeight: dev > 0.1 ? pick(WEIGHTS) : RESOLVED.fontWeight,
    fontSize: lerp(1, 0.3 + Math.random() * 1.4, dev),
    rotate: lerp(0, (Math.random() - 0.5) * 60, dev),
    skewX: lerp(0, (Math.random() - 0.5) * 30, dev),
    scaleX: lerp(1, 0.5 + Math.random() * 1.5, dev),
    color: dev > 0.05 ? pick(COLORS) : RESOLVED.color,
    letterSpacing: lerp(0, (Math.random() - 0.5) * 8, dev),
    fontStyle: dev > 0.3 && Math.random() > 0.6 ? "italic" : "normal",
    fontVariantCaps: dev > 0.4 ? pick(VARIANTS) : "normal",
  };
}

export default function AnimatedHeroHeading() {
  const [states, setStates] = useState<LetterStyle[]>(LETTERS.map(() => RESOLVED));
  const [phase, setPhase] = useState<"chaos" | "resolving" | "hold">("hold");
  const [tick, setTick] = useState(0);

  // Cycle: hold 2s → chaos 3s → resolve over 2s → hold 2s → repeat
  useEffect(() => {
    let t = 0;
    const iv = setInterval(() => {
      t++;
      setTick(t);

      // At 200ms tick: hold 15 ticks (3s), chaos 25 ticks (5s), resolve 15 ticks (3s)
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
      // Hold
      return LETTERS.map(() => RESOLVED);
    } else if (pos < 40) {
      // Chaos at configured regularity (73% = subtle)
      return LETTERS.map(() => randomStyle());
    } else {
      // Resolving: each letter converges
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
      className="text-5xl sm:text-8xl md:text-9xl font-bold tracking-tight leading-[0.9] mb-8"
      style={{ minHeight: "1.1em" }}
      aria-label="Web Typography"
    >
      <span style={{ fontFamily: "var(--font-playfair)", color: "#ffffff" }}>Web</span>
      <br />
      <span style={{ display: "inline-flex", alignItems: "baseline", whiteSpace: "nowrap" }}>
        {LETTERS.map((letter, i) => {
          const s = states[i] || RESOLVED;
          const isResolved = phase === "hold";
          return (
            /* Outer: fixed size based on resolved font, never changes layout */
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
              }}
            >
              {/* Invisible resolved letter holds the space */}
              {letter}
              {/* Visible chaos letter rendered on top */}
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
