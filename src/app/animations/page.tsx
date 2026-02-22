"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ─────────────────────────────────────────────
   Copy Button (inline to keep page self-contained)
   ───────────────────────────────────────────── */
function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1 text-xs font-mono tracking-wider uppercase border border-[#B8963E] text-[#B8963E] hover:bg-[#B8963E] hover:text-black transition-colors duration-200"
      style={{ borderRadius: 0 }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

/* ─────────────────────────────────────────────
   useInView hook for scroll-triggered demos
   ───────────────────────────────────────────── */
function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─────────────────────────────────────────────
   useScrollProgress hook
   ───────────────────────────────────────────── */
function useScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, 1 - rect.top / vh));
      setProgress(p);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return { ref, progress };
}

/* ─────────────────────────────────────────────
   Animation Card wrapper
   ───────────────────────────────────────────── */
function AnimationCard({
  name,
  category,
  when,
  whenNot,
  Demo,
  cssCode,
  reactCode,
}: {
  name: string;
  category: string;
  when: string;
  whenNot: string;
  Demo: React.ComponentType;
  cssCode: string;
  reactCode: string;
}) {
  const [tab, setTab] = useState<"css" | "react">("css");
  const [replayKey, setReplayKey] = useState(0);
  return (
    <div className="border border-neutral-800 bg-neutral-950/50" style={{ borderRadius: 0 }}>
      <div className="p-6 sm:p-8 border-b border-neutral-800">
        <div className="flex items-start justify-between mb-1">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">
            {category}
          </p>
          <button
            onClick={() => setReplayKey(k => k + 1)}
            className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-[#B8963E] transition-colors border border-neutral-800 px-2 py-1 hover:border-[#B8963E]"
          >
            Replay
          </button>
        </div>
        <h3
          className="text-2xl font-bold tracking-tight mb-4"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          {name}
        </h3>

        {/* Live demo */}
        <div className="p-6 bg-[#0a0a0a] border border-neutral-800 mb-6 min-h-[120px] flex items-center overflow-hidden">
          <Demo key={replayKey} />
        </div>

        {/* Taste guidance */}
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-neutral-900 border border-neutral-800">
            <p className="font-mono text-xs uppercase tracking-widest text-[#B8963E] mb-1">When to use</p>
            <p className="text-neutral-400" style={{ fontFamily: "var(--font-source-sans)" }}>{when}</p>
          </div>
          <div className="p-3 bg-neutral-900 border border-neutral-800">
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-600 mb-1">When not to</p>
            <p className="text-neutral-400" style={{ fontFamily: "var(--font-source-sans)" }}>{whenNot}</p>
          </div>
        </div>
      </div>

      {/* Code tabs */}
      <div>
        <div className="flex border-b border-neutral-800">
          <button
            onClick={() => setTab("css")}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${
              tab === "css" ? "text-[#B8963E] border-b border-[#B8963E]" : "text-neutral-600 hover:text-neutral-400"
            }`}
          >
            CSS
          </button>
          <button
            onClick={() => setTab("react")}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${
              tab === "react" ? "text-[#B8963E] border-b border-[#B8963E]" : "text-neutral-600 hover:text-neutral-400"
            }`}
          >
            React
          </button>
          <div className="ml-auto flex items-center pr-4 gap-2">
            <CopyBtn text={tab === "css" ? cssCode : reactCode} label={tab === "css" ? "Copy CSS" : "Copy Component"} />
          </div>
        </div>
        <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
          <code className="font-mono text-neutral-300">{tab === "css" ? cssCode : reactCode}</code>
        </pre>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════
   ANIMATION DEMOS
   ═════════════════════════════════════════════ */

/* ── 1. Fade Up Stagger ── */
function FadeUpStaggerDemo() {
  const { ref, inView } = useInView();
  const words = "Words appear one by one, rising gently from below".split(" ");
  return (
    <div ref={ref} className="w-full">
      <p className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-playfair)" }}>
        {words.map((w, i) => (
          <span
            key={i}
            className="inline-block mr-[0.3em] transition-all duration-700"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(20px)",
              transitionDelay: `${i * 80}ms`,
            }}
          >
            {w}
          </span>
        ))}
      </p>
    </div>
  );
}

/* ── 2. Character Reveal ── */
function CharacterRevealDemo() {
  const { ref, inView } = useInView();
  const text = "Each letter fades in";
  return (
    <div ref={ref} className="w-full">
      <p className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-playfair)" }}>
        {text.split("").map((ch, i) => (
          <span
            key={i}
            className="inline-block transition-opacity duration-500"
            style={{
              opacity: inView ? 1 : 0,
              transitionDelay: `${i * 40}ms`,
            }}
          >
            {ch === " " ? "\u00A0" : ch}
          </span>
        ))}
      </p>
    </div>
  );
}

/* ── 3. Line-by-Line Reveal ── */
function LineRevealDemo() {
  const { ref, inView } = useInView();
  const lines = [
    "First line appears with a clip-path wipe.",
    "Then the second line follows smoothly.",
    "And the third completes the sequence.",
  ];
  return (
    <div ref={ref} className="w-full space-y-2">
      {lines.map((line, i) => (
        <p
          key={i}
          className="text-lg transition-all duration-700"
          style={{
            fontFamily: "var(--font-source-sans)",
            clipPath: inView ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
            transitionDelay: `${i * 300}ms`,
          }}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

/* ── 4. Typewriter ── */
function TypewriterDemo() {
  const { ref, inView } = useInView();
  const text = "The machine speaks in monospace.";
  const [displayed, setDisplayed] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      setDisplayed(text.slice(0, idx));
      if (idx >= text.length) clearInterval(interval);
    }, 60);
    return () => clearInterval(interval);
  }, [inView]);

  useEffect(() => {
    const blink = setInterval(() => setCursorVisible((v) => !v), 530);
    return () => clearInterval(blink);
  }, []);

  return (
    <div ref={ref} className="w-full">
      <p className="text-xl font-mono text-neutral-200">
        {displayed}
        <span className="inline-block w-[2px] h-[1.1em] bg-[#B8963E] ml-[2px] align-middle" style={{ opacity: cursorVisible ? 1 : 0 }} />
      </p>
    </div>
  );
}

/* ── 5. Weight Shift ── */
function WeightShiftDemo() {
  return (
    <div className="w-full">
      <p
        className="text-2xl tracking-tight cursor-pointer select-none"
        style={{
          fontFamily: "var(--font-inter)",
          fontWeight: 400,
          transition: "font-weight 0.4s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.fontWeight = "700")}
        onMouseLeave={(e) => (e.currentTarget.style.fontWeight = "400")}
      >
        Hover to feel the weight shift
      </p>
      <p className="text-xs font-mono text-neutral-600 mt-2">Hover the text above</p>
    </div>
  );
}

/* ── 6. Underline Draw ── */
function UnderlineDrawDemo() {
  return (
    <div className="w-full">
      <style>{`
        .underline-draw {
          position: relative;
          display: inline;
          cursor: pointer;
        }
        .underline-draw::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: -2px;
          width: 0;
          height: 2px;
          background: #B8963E;
          transition: width 0.4s ease;
        }
        .underline-draw:hover::after {
          width: 100%;
        }
      `}</style>
      <p className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-playfair)" }}>
        <span className="underline-draw">Hover to draw the underline</span>
      </p>
      <p className="text-xs font-mono text-neutral-600 mt-2">Hover the text above</p>
    </div>
  );
}

/* ── 7. Highlight Sweep ── */
function HighlightSweepDemo() {
  return (
    <div className="w-full">
      <style>{`
        .highlight-sweep {
          background: linear-gradient(90deg, rgba(184,150,62,0.25) 50%, transparent 50%);
          background-size: 200% 100%;
          background-position: 100% 0;
          transition: background-position 0.5s ease;
          cursor: pointer;
          padding: 2px 0;
        }
        .highlight-sweep:hover {
          background-position: 0 0;
        }
      `}</style>
      <p className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-playfair)" }}>
        <span className="highlight-sweep">Hover to sweep the highlight across</span>
      </p>
      <p className="text-xs font-mono text-neutral-600 mt-2">Hover the text above</p>
    </div>
  );
}

/* ── 8. Letter Spacing Breathe ── */
function LetterSpacingDemo() {
  return (
    <div className="w-full">
      <p
        className="text-2xl font-bold uppercase tracking-[0.05em] cursor-pointer select-none"
        style={{
          fontFamily: "var(--font-space-grotesk)",
          transition: "letter-spacing 0.6s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.letterSpacing = "0.15em")}
        onMouseLeave={(e) => (e.currentTarget.style.letterSpacing = "0.05em")}
      >
        Hover to breathe
      </p>
      <p className="text-xs font-mono text-neutral-600 mt-2">Hover the text above</p>
    </div>
  );
}

/* ── 9. Blur to Sharp ── */
function BlurToSharpDemo() {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} className="w-full">
      <p
        className="text-3xl font-bold tracking-tight transition-all duration-1000"
        style={{
          fontFamily: "var(--font-playfair)",
          filter: inView ? "blur(0px)" : "blur(8px)",
          opacity: inView ? 1 : 0.3,
        }}
      >
        Clarity arrives gradually
      </p>
    </div>
  );
}

/* ── 10. Color Shift ── */
function ColorShiftDemo() {
  const { ref, progress } = useScrollProgress();
  const hue = Math.round(40 + progress * 160);
  return (
    <div ref={ref} className="w-full">
      <p
        className="text-3xl font-bold tracking-tight"
        style={{
          fontFamily: "var(--font-playfair)",
          color: `hsl(${hue}, 50%, 60%)`,
          transition: "color 0.1s linear",
        }}
      >
        Color follows your scroll
      </p>
      <p className="text-xs font-mono text-neutral-600 mt-2">Scroll to shift the hue</p>
    </div>
  );
}

/* ── 11. Split and Rejoin ── */
function SplitRejoinDemo() {
  const { ref, inView } = useInView();
  const words = ["Split", "apart,", "then", "come", "together"];
  return (
    <div ref={ref} className="w-full text-center">
      <p className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-playfair)" }}>
        {words.map((w, i) => {
          const offset = (i - Math.floor(words.length / 2)) * 30;
          return (
            <span
              key={i}
              className="inline-block mr-[0.3em] transition-all duration-800"
              style={{
                transform: inView ? "translateX(0)" : `translateX(${offset}px)`,
                opacity: inView ? 1 : 0.4,
                transitionDuration: "0.8s",
                transitionDelay: `${i * 60}ms`,
              }}
            >
              {w}
            </span>
          );
        })}
      </p>
    </div>
  );
}

/* ── 12. Parallax Text Layers ── */
function ParallaxDemo() {
  const { ref, progress } = useScrollProgress();
  return (
    <div ref={ref} className="w-full relative h-[120px] overflow-hidden">
      <p
        className="text-4xl font-bold tracking-tight absolute"
        style={{
          fontFamily: "var(--font-playfair)",
          transform: `translateY(${progress * -30}px)`,
          transition: "transform 0.1s linear",
        }}
      >
        Heading Layer
      </p>
      <p
        className="text-base text-neutral-400 absolute top-16"
        style={{
          fontFamily: "var(--font-source-sans)",
          transform: `translateY(${progress * -10}px)`,
          transition: "transform 0.1s linear",
        }}
      >
        Body text moves at a different rate, creating depth between layers.
      </p>
    </div>
  );
}

/* ── 13. Progressive Reveal ── */
function ProgressiveRevealDemo() {
  const { ref, progress } = useScrollProgress();
  const text = "This text reveals itself as you scroll down the page, each word becoming visible in sequence.";
  const words = text.split(" ");
  return (
    <div ref={ref} className="w-full">
      <p className="text-xl leading-relaxed" style={{ fontFamily: "var(--font-source-sans)" }}>
        {words.map((w, i) => {
          const wordProgress = i / words.length;
          const opacity = Math.min(1, Math.max(0.1, (progress - wordProgress * 0.7) * 3));
          return (
            <span key={i} className="inline-block mr-[0.3em]" style={{ opacity }}>
              {w}
            </span>
          );
        })}
      </p>
      <p className="text-xs font-mono text-neutral-600 mt-2">Scroll to reveal</p>
    </div>
  );
}

/* ── 14. Scale on Scroll ── */
function ScaleOnScrollDemo() {
  const { ref, progress } = useScrollProgress();
  const scale = 0.7 + progress * 0.5;
  return (
    <div ref={ref} className="w-full text-center">
      <p
        className="text-3xl font-bold tracking-tight"
        style={{
          fontFamily: "var(--font-playfair)",
          transform: `scale(${Math.min(1.2, scale)})`,
          transformOrigin: "center",
          transition: "transform 0.1s linear",
        }}
      >
        Scale follows scroll
      </p>
      <p className="text-xs font-mono text-neutral-600 mt-2">Scroll to scale</p>
    </div>
  );
}

/* ═════════════════════════════════════════════
   CODE SNIPPETS
   ═════════════════════════════════════════════ */

const snippets = {
  fadeUpStagger: {
    css: `.fade-up-stagger .word {
  display: inline-block;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.7s ease, transform 0.7s ease;
  margin-right: 0.3em;
}
.fade-up-stagger.visible .word {
  opacity: 1;
  transform: translateY(0);
}
/* Stagger each word: */
.fade-up-stagger.visible .word:nth-child(1) { transition-delay: 0ms; }
.fade-up-stagger.visible .word:nth-child(2) { transition-delay: 80ms; }
.fade-up-stagger.visible .word:nth-child(3) { transition-delay: 160ms; }
/* ...continue for each word */`,
    react: `function FadeUpStagger({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <p ref={ref}>
      {text.split(" ").map((word, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            marginRight: "0.3em",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
            transitionDelay: \`\${i * 80}ms\`,
          }}
        >
          {word}
        </span>
      ))}
    </p>
  );
}`,
  },
  characterReveal: {
    css: `.char-reveal .char {
  display: inline-block;
  opacity: 0;
  transition: opacity 0.5s ease;
}
.char-reveal.visible .char {
  opacity: 1;
}
/* Stagger via nth-child or inline delay */`,
    react: `function CharacterReveal({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <p ref={ref}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            opacity: visible ? 1 : 0,
            transition: "opacity 0.5s ease",
            transitionDelay: \`\${i * 40}ms\`,
          }}
        >
          {ch === " " ? "\\u00A0" : ch}
        </span>
      ))}
    </p>
  );
}`,
  },
  lineReveal: {
    css: `.line-reveal .line {
  clip-path: inset(0 100% 0 0);
  transition: clip-path 0.7s ease;
}
.line-reveal.visible .line {
  clip-path: inset(0 0 0 0);
}
.line-reveal.visible .line:nth-child(2) { transition-delay: 300ms; }
.line-reveal.visible .line:nth-child(3) { transition-delay: 600ms; }`,
    react: `function LineReveal({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {lines.map((line, i) => (
        <p
          key={i}
          style={{
            clipPath: visible ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
            transition: "clip-path 0.7s ease",
            transitionDelay: \`\${i * 300}ms\`,
          }}
        >
          {line}
        </p>
      ))}
    </div>
  );
}`,
  },
  typewriter: {
    css: `.typewriter {
  font-family: monospace;
  border-right: 2px solid #B8963E;
  white-space: nowrap;
  overflow: hidden;
  width: 0;
  animation: typing 3s steps(30) forwards, blink 0.53s step-end infinite;
}
@keyframes typing {
  to { width: 100%; }
}
@keyframes blink {
  50% { border-color: transparent; }
}`,
    react: `function Typewriter({ text, speed = 60 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [cursorOn, setCursorOn] = useState(true);
  const started = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          let idx = 0;
          const iv = setInterval(() => {
            idx++;
            setDisplayed(text.slice(0, idx));
            if (idx >= text.length) clearInterval(iv);
          }, speed);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [text, speed]);

  useEffect(() => {
    const iv = setInterval(() => setCursorOn(v => !v), 530);
    return () => clearInterval(iv);
  }, []);

  return (
    <p ref={ref} style={{ fontFamily: "monospace" }}>
      {displayed}
      <span style={{
        display: "inline-block", width: 2,
        height: "1.1em", background: "#B8963E",
        marginLeft: 2, verticalAlign: "middle",
        opacity: cursorOn ? 1 : 0,
      }} />
    </p>
  );
}`,
  },
  weightShift: {
    css: `.weight-shift {
  font-weight: 400;
  transition: font-weight 0.4s ease;
  cursor: pointer;
}
.weight-shift:hover {
  font-weight: 700;
}
/* Requires a variable font for smooth interpolation */`,
    react: `function WeightShift({ children }: { children: React.ReactNode }) {
  const [hovering, setHovering] = useState(false);
  return (
    <span
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        fontWeight: hovering ? 700 : 400,
        transition: "font-weight 0.4s ease",
        cursor: "pointer",
      }}
    >
      {children}
    </span>
  );
}`,
  },
  underlineDraw: {
    css: `.underline-draw {
  position: relative;
  display: inline;
  cursor: pointer;
}
.underline-draw::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -2px;
  width: 0;
  height: 2px;
  background: #B8963E;
  transition: width 0.4s ease;
}
.underline-draw:hover::after {
  width: 100%;
}`,
    react: `function UnderlineDraw({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{\`
        .underline-draw { position: relative; display: inline; cursor: pointer; }
        .underline-draw::after {
          content: ''; position: absolute; left: 0; bottom: -2px;
          width: 0; height: 2px; background: #B8963E;
          transition: width 0.4s ease;
        }
        .underline-draw:hover::after { width: 100%; }
      \`}</style>
      <span className="underline-draw">{children}</span>
    </>
  );
}`,
  },
  highlightSweep: {
    css: `.highlight-sweep {
  background: linear-gradient(90deg, rgba(184,150,62,0.25) 50%, transparent 50%);
  background-size: 200% 100%;
  background-position: 100% 0;
  transition: background-position 0.5s ease;
  cursor: pointer;
  padding: 2px 0;
}
.highlight-sweep:hover {
  background-position: 0 0;
}`,
    react: `function HighlightSweep({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{\`
        .highlight-sweep {
          background: linear-gradient(90deg, rgba(184,150,62,0.25) 50%, transparent 50%);
          background-size: 200% 100%;
          background-position: 100% 0;
          transition: background-position 0.5s ease;
          cursor: pointer; padding: 2px 0;
        }
        .highlight-sweep:hover { background-position: 0 0; }
      \`}</style>
      <span className="highlight-sweep">{children}</span>
    </>
  );
}`,
  },
  letterSpacing: {
    css: `.letter-breathe {
  letter-spacing: 0.05em;
  transition: letter-spacing 0.6s ease;
  cursor: pointer;
  text-transform: uppercase;
}
.letter-breathe:hover {
  letter-spacing: 0.15em;
}`,
    react: `function LetterBreathe({ children }: { children: React.ReactNode }) {
  const [hovering, setHovering] = useState(false);
  return (
    <span
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        letterSpacing: hovering ? "0.15em" : "0.05em",
        transition: "letter-spacing 0.6s ease",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {children}
    </span>
  );
}`,
  },
  blurToSharp: {
    css: `.blur-to-sharp {
  filter: blur(8px);
  opacity: 0.3;
  transition: filter 1s ease, opacity 1s ease;
}
.blur-to-sharp.visible {
  filter: blur(0px);
  opacity: 1;
}`,
    react: `function BlurToSharp({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        filter: visible ? "blur(0px)" : "blur(8px)",
        opacity: visible ? 1 : 0.3,
        transition: "filter 1s ease, opacity 1s ease",
      }}
    >
      {children}
    </div>
  );
}`,
  },
  colorShift: {
    css: `/* Pure CSS approximation using scroll-driven animations */
@keyframes hue-shift {
  from { color: hsl(40, 50%, 60%); }
  to   { color: hsl(200, 50%, 60%); }
}
.color-shift {
  animation: hue-shift linear;
  animation-timeline: scroll();
}`,
    react: `function ColorShift({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hue, setHue] = useState(40);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, 1 - rect.top / window.innerHeight));
      setHue(Math.round(40 + progress * 160));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={ref} style={{ color: \`hsl(\${hue}, 50%, 60%)\` }}>
      {children}
    </div>
  );
}`,
  },
  splitRejoin: {
    css: `.split-rejoin .word {
  display: inline-block;
  margin-right: 0.3em;
  opacity: 0.4;
  transition: transform 0.8s ease, opacity 0.8s ease;
}
.split-rejoin.visible .word {
  transform: translateX(0);
  opacity: 1;
}
/* Set initial translateX per word via inline styles or nth-child */`,
    react: `function SplitRejoin({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [visible, setVisible] = useState(false);
  const words = text.split(" ");

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <p ref={ref} style={{ textAlign: "center" }}>
      {words.map((w, i) => {
        const offset = (i - Math.floor(words.length / 2)) * 30;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              marginRight: "0.3em",
              transform: visible ? "translateX(0)" : \`translateX(\${offset}px)\`,
              opacity: visible ? 1 : 0.4,
              transition: "transform 0.8s ease, opacity 0.8s ease",
              transitionDelay: \`\${i * 60}ms\`,
            }}
          >
            {w}
          </span>
        );
      })}
    </p>
  );
}`,
  },
  parallax: {
    css: `/* Use scroll-driven animations (modern CSS) */
.parallax-heading {
  animation: parallax-fast linear;
  animation-timeline: scroll();
}
.parallax-body {
  animation: parallax-slow linear;
  animation-timeline: scroll();
}
@keyframes parallax-fast {
  to { transform: translateY(-30px); }
}
@keyframes parallax-slow {
  to { transform: translateY(-10px); }
}`,
    react: `function ParallaxLayers() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, 1 - rect.top / window.innerHeight));
      setProgress(p);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", height: 120 }}>
      <h2 style={{ transform: \`translateY(\${progress * -30}px)\` }}>
        Heading
      </h2>
      <p style={{ transform: \`translateY(\${progress * -10}px)\` }}>
        Body text at a different rate.
      </p>
    </div>
  );
}`,
  },
  progressiveReveal: {
    css: `/* Scroll-driven animation approach */
.progressive-reveal .word {
  display: inline-block;
  margin-right: 0.3em;
  opacity: 0.1;
  animation: reveal linear;
  animation-timeline: scroll();
}
@keyframes reveal {
  to { opacity: 1; }
}
/* Stagger via animation-delay or animation-range */`,
    react: `function ProgressiveReveal({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const words = text.split(" ");

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, 1 - rect.top / window.innerHeight));
      setProgress(p);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <p ref={ref}>
      {words.map((w, i) => {
        const wp = i / words.length;
        const opacity = Math.min(1, Math.max(0.1, (progress - wp * 0.7) * 3));
        return (
          <span key={i} style={{ display: "inline-block", marginRight: "0.3em", opacity }}>
            {w}
          </span>
        );
      })}
    </p>
  );
}`,
  },
  scaleOnScroll: {
    css: `/* Scroll-driven animation */
.scale-on-scroll {
  animation: scale-up linear;
  animation-timeline: scroll();
  transform-origin: center;
}
@keyframes scale-up {
  from { transform: scale(0.7); }
  to   { transform: scale(1.2); }
}`,
    react: `function ScaleOnScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, 1 - rect.top / window.innerHeight));
      setScale(Math.min(1.2, 0.7 + p * 0.5));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={ref} style={{ transform: \`scale(\${scale})\`, transformOrigin: "center", textAlign: "center" }}>
      {children}
    </div>
  );
}`,
  },
};

/* ═════════════════════════════════════════════
   MAIN PAGE
   ═════════════════════════════════════════════ */

export default function AnimationsPage() {
  return (
    <main className="min-h-screen">
      {/* ── Header ── */}
      <header className="border-b border-neutral-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a
            href="/"
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Web Typography
          </a>
          <nav className="flex gap-6 text-xs font-mono uppercase tracking-widest text-neutral-600">
            <a href="/" className="hover:text-[#B8963E] transition-colors">Home</a>
            <a href="/pairing-cards" className="hover:text-[#B8963E] transition-colors">Builder</a>
            <a href="/animations" className="text-[#B8963E]">Animations</a>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
          Typography Animations
        </p>
        <h1
          className="text-4xl sm:text-6xl font-bold tracking-tight mb-4"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Motion with Purpose
        </h1>
        <p
          className="text-neutral-400 max-w-2xl leading-relaxed"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          14 tasteful, copy-ready typography animations. Each one is designed to
          make text more impactful, never less readable. Think editorial
          magazine, not PowerPoint transitions.
        </p>
        <div className="mt-8 flex flex-wrap gap-6 text-xs font-mono uppercase tracking-widest text-neutral-600">
          <a href="#entrances" className="hover:text-[#B8963E] transition-colors">Entrances</a>
          <a href="#emphasis" className="hover:text-[#B8963E] transition-colors">Emphasis</a>
          <a href="#transitions" className="hover:text-[#B8963E] transition-colors">Transitions</a>
          <a href="#scrolling" className="hover:text-[#B8963E] transition-colors">Scrolling</a>
        </div>
      </section>

      {/* ── Entrances ── */}
      <section id="entrances" className="border-t border-neutral-800">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            01 -- Entrances
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-16"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            First Impressions
          </h2>

          <div className="space-y-12">
            <AnimationCard
              name="Fade Up with Stagger"
              category="Entrance"
              when="Hero headlines, section titles on landing pages. Draws the eye naturally."
              whenNot="Body paragraphs or UI text. Staggering long content feels slow and annoying."
              Demo={FadeUpStaggerDemo}
              cssCode={snippets.fadeUpStagger.css}
              reactCode={snippets.fadeUpStagger.react}
            />
            <AnimationCard
              name="Character Reveal"
              category="Entrance"
              when="Short, impactful phrases -- brand names, taglines, pull quotes."
              whenNot="Anything longer than 30 characters. Per-letter animation on a paragraph is torture."
              Demo={CharacterRevealDemo}
              cssCode={snippets.characterReveal.css}
              reactCode={snippets.characterReveal.react}
            />
            <AnimationCard
              name="Line-by-Line Reveal"
              category="Entrance"
              when="Multi-line quotes, testimonials, step-by-step instructions."
              whenNot="Dense body copy. The clip-path wipe implies sequence -- don't use it where order does not matter."
              Demo={LineRevealDemo}
              cssCode={snippets.lineReveal.css}
              reactCode={snippets.lineReveal.react}
            />
            <AnimationCard
              name="Typewriter"
              category="Entrance"
              when="Terminal aesthetics, code-themed sites, command-line interfaces."
              whenNot="Serif or editorial contexts. The monospace cursor breaks the typographic voice."
              Demo={TypewriterDemo}
              cssCode={snippets.typewriter.css}
              reactCode={snippets.typewriter.react}
            />
          </div>
        </div>
      </section>

      {/* ── Emphasis ── */}
      <section id="emphasis" className="border-t border-neutral-800">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            02 -- Emphasis
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-16"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Drawing Attention
          </h2>

          <div className="space-y-12">
            <AnimationCard
              name="Subtle Weight Shift"
              category="Emphasis"
              when="Navigation links, interactive labels, variable-font-powered interfaces."
              whenNot="Static text or fonts without weight axis. Without a variable font, the jump is harsh."
              Demo={WeightShiftDemo}
              cssCode={snippets.weightShift.css}
              reactCode={snippets.weightShift.react}
            />
            <AnimationCard
              name="Underline Draw"
              category="Emphasis"
              when="Navigation links, call-to-action text, inline links in editorial content."
              whenNot="Every link on the page. If everything draws, nothing stands out."
              Demo={UnderlineDrawDemo}
              cssCode={snippets.underlineDraw.css}
              reactCode={snippets.underlineDraw.react}
            />
            <AnimationCard
              name="Highlight Sweep"
              category="Emphasis"
              when="Key phrases in articles, feature highlights, marketing copy."
              whenNot="Headings (too heavy) or body text (too distracting for continuous reading)."
              Demo={HighlightSweepDemo}
              cssCode={snippets.highlightSweep.css}
              reactCode={snippets.highlightSweep.react}
            />
            <AnimationCard
              name="Letter Spacing Breathe"
              category="Emphasis"
              when="Uppercase labels, navigation items, short headings."
              whenNot="Lowercase body text. Expanding letter spacing on lowercase makes it harder to read."
              Demo={LetterSpacingDemo}
              cssCode={snippets.letterSpacing.css}
              reactCode={snippets.letterSpacing.react}
            />
          </div>
        </div>
      </section>

      {/* ── Transitions ── */}
      <section id="transitions" className="border-t border-neutral-800">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            03 -- Transitions
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-16"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            State Changes
          </h2>

          <div className="space-y-12">
            <AnimationCard
              name="Blur to Sharp"
              category="Transition"
              when="Hero text, dramatic reveals, content that loads progressively."
              whenNot="Repeated elements or lists. The blur effect loses impact when overused."
              Demo={BlurToSharpDemo}
              cssCode={snippets.blurToSharp.css}
              reactCode={snippets.blurToSharp.react}
            />
            <AnimationCard
              name="Color Shift"
              category="Transition"
              when="Data visualization headings, scroll-storytelling, mood-driven pages."
              whenNot="Accessibility-critical text. Changing color on scroll can confuse screen readers and break contrast ratios."
              Demo={ColorShiftDemo}
              cssCode={snippets.colorShift.css}
              reactCode={snippets.colorShift.react}
            />
            <AnimationCard
              name="Split and Rejoin"
              category="Transition"
              when="Section transitions, dramatic reveals, short impactful phrases."
              whenNot="Long sentences. The splitting effect becomes chaotic with too many words."
              Demo={SplitRejoinDemo}
              cssCode={snippets.splitRejoin.css}
              reactCode={snippets.splitRejoin.react}
            />
          </div>
        </div>
      </section>

      {/* ── Scrolling ── */}
      <section id="scrolling" className="border-t border-neutral-800">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            04 -- Scrolling
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-16"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Scroll-Driven
          </h2>

          <div className="space-y-12">
            <AnimationCard
              name="Parallax Text Layers"
              category="Scrolling"
              when="Landing pages, editorial long-reads, section headers with supporting body text."
              whenNot="Mobile-first designs. Parallax effects can feel janky on touch devices."
              Demo={ParallaxDemo}
              cssCode={snippets.parallax.css}
              reactCode={snippets.parallax.react}
            />
            <AnimationCard
              name="Progressive Reveal"
              category="Scrolling"
              when="Storytelling, long-form narratives, manifesto-style content."
              whenNot="Content users need to scan quickly. Forced sequential reading frustrates skimmers."
              Demo={ProgressiveRevealDemo}
              cssCode={snippets.progressiveReveal.css}
              reactCode={snippets.progressiveReveal.react}
            />
            <AnimationCard
              name="Scale on Scroll"
              category="Scrolling"
              when="Hero headings, dramatic single-word titles, section transitions."
              whenNot="Body text or anything meant to be read. Scaling distorts readability."
              Demo={ScaleOnScrollDemo}
              cssCode={snippets.scaleOnScroll.css}
              reactCode={snippets.scaleOnScroll.react}
            />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-neutral-800 py-12 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">
          Built with care for the craft of typography
        </p>
      </footer>
    </main>
  );
}
