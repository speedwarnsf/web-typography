"use client";

import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";

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
   COLOR PALETTE CONTEXT (for experimental demos)
   ═════════════════════════════════════════════ */

/* --- helpers --- */
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const s1 = s / 100, l1 = l / 100;
  const a = s1 * Math.min(l1, 1 - l1);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l1 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function generateMonoShades(hex: string, count: number): string[] {
  const [h, s] = hexToHsl(hex);
  const shades: string[] = [];
  for (let i = 0; i < count; i++) {
    const l = 15 + (70 / Math.max(1, count - 1)) * i;
    const sMod = s * (0.6 + 0.4 * (1 - Math.abs(l - 50) / 50));
    shades.push(hslToHex(h, Math.round(sMod), Math.round(l)));
  }
  return shades;
}

const DEFAULT_COLORS = ["#B8963E", "#ff3333", "#33ff33", "#3333ff", "#ff33ff", "#33ffff", "#ffff33", "#ff6600", "#9933ff", "#ffffff", "#ff0066", "#00ff99"];

const PaletteContext = createContext<{ colors: string[] }>({ colors: DEFAULT_COLORS });

function usePalette() {
  return useContext(PaletteContext);
}

type ResolvedStyle = {
  text: string;
  fontFamily: string;
  fontFamilyLabel: string;
  fontWeight: number;
  fontSize: number;
  color: string;
  letterSpacing: number;
  textTransform: "none" | "uppercase" | "lowercase";
};

const DEFAULT_RESOLVED: ResolvedStyle = {
  text: "Typography",
  fontFamily: "var(--font-playfair)",
  fontFamilyLabel: "Playfair Display",
  fontWeight: 700,
  fontSize: 36,
  color: "#ffffff",
  letterSpacing: 2,
  textTransform: "none",
};

type ChaosControls = {
  resolved: ResolvedStyle;
  speed: number;        // 1-10, default 5
  regularity: number;   // 0-100, 0=full chaos, 100=fully resolved
  lockedLetters: Set<number>;  // indices locked to resolved
  toggleLock: (i: number) => void;
};

const ChaosContext = createContext<ChaosControls>({
  resolved: DEFAULT_RESOLVED,
  speed: 5,
  regularity: 0,
  lockedLetters: new Set(),
  toggleLock: () => {},
});

function useChaos() {
  return useContext(ChaosContext);
}

// Keep backward compat
function useResolved() {
  return useChaos().resolved;
}

const FONT_OPTIONS = [
  { label: "Playfair Display", value: "var(--font-playfair)" },
  { label: "Inter", value: "var(--font-inter)" },
  { label: "Source Sans", value: "var(--font-source-sans)" },
  { label: "Georgia", value: "Georgia" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Garamond", value: "Garamond" },
  { label: "Palatino", value: "Palatino" },
  { label: "Courier New", value: "Courier New" },
  { label: "Monospace", value: "monospace" },
  { label: "Impact", value: "Impact" },
  { label: "Trebuchet MS", value: "Trebuchet MS" },
  { label: "Arial Black", value: "Arial Black" },
];

function TargetStylePicker({ style, onChange }: { style: ResolvedStyle; onChange: (s: ResolvedStyle) => void }) {
  return (
    <div className="mb-6 p-6 border border-neutral-800 bg-neutral-950/50">
      <p className="font-mono text-xs uppercase tracking-widest text-neutral-600 mb-4">
        Target Style (resolved form)
      </p>

      {/* Text input */}
      <div className="flex items-center gap-4 mb-4">
        <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 w-20 shrink-0">Text</label>
        <input
          type="text"
          value={style.text}
          onChange={(e) => onChange({ ...style, text: e.target.value || "Typography" })}
          maxLength={30}
          className="font-mono text-sm text-neutral-200 bg-transparent border border-neutral-800 px-3 py-1.5 flex-1"
          style={{ borderRadius: 0 }}
          placeholder="Typography"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Font family */}
        <div className="flex items-center gap-3">
          <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 w-20 shrink-0">Font</label>
          <select
            value={style.fontFamily}
            onChange={(e) => {
              const opt = FONT_OPTIONS.find(f => f.value === e.target.value);
              onChange({ ...style, fontFamily: e.target.value, fontFamilyLabel: opt?.label || e.target.value });
            }}
            className="font-mono text-xs text-neutral-300 bg-neutral-950 border border-neutral-800 px-2 py-1.5 flex-1"
            style={{ borderRadius: 0 }}
          >
            {FONT_OPTIONS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Weight */}
        <div className="flex items-center gap-3">
          <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 w-20 shrink-0">Weight</label>
          <input
            type="range" min={100} max={900} step={100} value={style.fontWeight}
            onChange={(e) => onChange({ ...style, fontWeight: parseInt(e.target.value) })}
            className="flex-1 accent-[#B8963E]"
          />
          <span className="font-mono text-xs text-neutral-400 w-8 text-right">{style.fontWeight}</span>
        </div>

        {/* Size */}
        <div className="flex items-center gap-3">
          <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 w-20 shrink-0">Size</label>
          <input
            type="range" min={14} max={72} value={style.fontSize}
            onChange={(e) => onChange({ ...style, fontSize: parseInt(e.target.value) })}
            className="flex-1 accent-[#B8963E]"
          />
          <span className="font-mono text-xs text-neutral-400 w-10 text-right">{style.fontSize}px</span>
        </div>

        {/* Color */}
        <div className="flex items-center gap-3">
          <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 w-20 shrink-0">Color</label>
          <input
            type="color" value={style.color}
            onChange={(e) => onChange({ ...style, color: e.target.value })}
            className="w-8 h-8 border border-neutral-700 bg-transparent cursor-pointer"
            style={{ borderRadius: 0 }}
          />
          <span className="font-mono text-xs text-neutral-400">{style.color}</span>
        </div>

        {/* Case */}
        <div className="flex items-center gap-3">
          <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 w-20 shrink-0">Case</label>
          <div className="flex gap-2">
            {(["none", "uppercase", "lowercase"] as const).map(tt => (
              <button
                key={tt}
                onClick={() => onChange({ ...style, textTransform: tt })}
                className={`px-2 py-1 text-[10px] font-mono uppercase tracking-widest border transition-colors ${
                  style.textTransform === tt ? "border-[#B8963E] text-[#B8963E]" : "border-neutral-800 text-neutral-600 hover:text-neutral-400"
                }`}
                style={{ borderRadius: 0 }}
              >
                {tt === "none" ? "As typed" : tt === "uppercase" ? "UPPER" : "lower"}
              </button>
            ))}
          </div>
        </div>

        {/* Letter spacing */}
        <div className="flex items-center gap-3">
          <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 w-20 shrink-0">Spacing</label>
          <input
            type="range" min={-2} max={20} value={style.letterSpacing}
            onChange={(e) => onChange({ ...style, letterSpacing: parseInt(e.target.value) })}
            className="flex-1 accent-[#B8963E]"
          />
          <span className="font-mono text-xs text-neutral-400 w-10 text-right">{style.letterSpacing}px</span>
        </div>
      </div>

      {/* Preview */}
      <div className="mt-4 p-4 border border-neutral-800 bg-[#0a0a0a] flex justify-center">
        <span style={{
          fontFamily: style.fontFamily,
          fontWeight: style.fontWeight,
          fontSize: `${style.fontSize}px`,
          color: style.color,
          letterSpacing: `${style.letterSpacing}px`,
          textTransform: style.textTransform,
          lineHeight: 1.2,
        }}>
          {style.text}
        </span>
      </div>
    </div>
  );
}

function ChaosControlsPanel({ speed, onSpeedChange, regularity, onRegularityChange, lockedCount, onUnlockAll }: {
  speed: number; onSpeedChange: (n: number) => void;
  regularity: number; onRegularityChange: (n: number) => void;
  lockedCount: number; onUnlockAll: () => void;
}) {
  // Map speed 1-10 to display
  const speedLabels = ["", "Glacial", "Slow", "Gentle", "Easy", "Medium", "Quick", "Fast", "Rapid", "Frantic", "Insane"];
  return (
    <div className="mb-6 p-6 border border-neutral-800 bg-neutral-950/50">
      <p className="font-mono text-xs uppercase tracking-widest text-neutral-600 mb-4">
        Chaos Controls
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Speed */}
        <div className="flex items-center gap-3">
          <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 w-24 shrink-0">Speed</label>
          <input
            type="range" min={1} max={10} value={speed}
            onChange={(e) => onSpeedChange(parseInt(e.target.value))}
            className="flex-1 accent-[#B8963E]"
          />
          <span className="font-mono text-[10px] text-neutral-400 w-16 text-right">{speedLabels[speed]}</span>
        </div>

        {/* Regularity */}
        <div className="flex items-center gap-3">
          <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 w-24 shrink-0">Regularity</label>
          <input
            type="range" min={0} max={100} value={regularity}
            onChange={(e) => onRegularityChange(parseInt(e.target.value))}
            className="flex-1 accent-[#B8963E]"
          />
          <span className="font-mono text-[10px] text-neutral-400 w-12 text-right">{regularity}%</span>
        </div>
      </div>

      {/* Per-letter lock info */}
      <div className="mt-3 flex items-center justify-between">
        <p className="font-mono text-[10px] text-neutral-600">
          Click individual letters in the demos to lock/unlock them to the resolved style
          {lockedCount > 0 && ` -- ${lockedCount} locked`}
        </p>
        {lockedCount > 0 && (
          <button
            onClick={onUnlockAll}
            className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-[#B8963E] border border-neutral-800 hover:border-[#B8963E] px-2 py-0.5 transition-colors"
            style={{ borderRadius: 0 }}
          >
            Unlock all
          </button>
        )}
      </div>
    </div>
  );
}

function ColorPaletteBuilder({ colors, onChange }: { colors: string[]; onChange: (c: string[]) => void }) {
  const [mode, setMode] = useState<"mono" | "custom">(colors.length <= 1 ? "mono" : "custom");
  const [baseColor, setBaseColor] = useState("#B8963E");
  const [shadeCount, setShadeCount] = useState(8);

  const handleMono = useCallback((hex: string, count: number) => {
    setBaseColor(hex);
    setShadeCount(count);
    onChange(generateMonoShades(hex, count));
  }, [onChange]);

  const addColor = useCallback(() => {
    if (colors.length >= 24) return;
    // Pick a random hue that's different from existing
    const newHex = hslToHex(Math.floor(Math.random() * 360), 70, 55);
    onChange([...colors, newHex]);
  }, [colors, onChange]);

  const removeColor = useCallback((idx: number) => {
    if (colors.length <= 1) return;
    onChange(colors.filter((_, i) => i !== idx));
  }, [colors, onChange]);

  const updateColor = useCallback((idx: number, hex: string) => {
    const next = [...colors];
    next[idx] = hex;
    onChange(next);
  }, [colors, onChange]);

  return (
    <div className="mb-12 p-6 border border-neutral-800 bg-neutral-950/50">
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">
          Color Palette ({colors.length} color{colors.length !== 1 ? "s" : ""})
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => { setMode("mono"); handleMono(baseColor, shadeCount); }}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-colors ${
              mode === "mono" ? "border-[#B8963E] text-[#B8963E]" : "border-neutral-800 text-neutral-600 hover:text-neutral-400"
            }`}
            style={{ borderRadius: 0 }}
          >
            Monochrome
          </button>
          <button
            onClick={() => { setMode("custom"); if (colors.length < 2) onChange(DEFAULT_COLORS); }}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-colors ${
              mode === "custom" ? "border-[#B8963E] text-[#B8963E]" : "border-neutral-800 text-neutral-600 hover:text-neutral-400"
            }`}
            style={{ borderRadius: 0 }}
          >
            Custom
          </button>
        </div>
      </div>

      {mode === "mono" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 w-20">Base</label>
            <input
              type="color"
              value={baseColor}
              onChange={(e) => handleMono(e.target.value, shadeCount)}
              className="w-10 h-10 border border-neutral-700 bg-transparent cursor-pointer"
              style={{ borderRadius: 0 }}
            />
            <input
              type="text"
              value={baseColor}
              onChange={(e) => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) handleMono(e.target.value, shadeCount); }}
              className="font-mono text-xs text-neutral-300 bg-transparent border border-neutral-800 px-2 py-1 w-24"
              style={{ borderRadius: 0 }}
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 w-20">Shades</label>
            <input
              type="range"
              min={1}
              max={24}
              value={shadeCount}
              onChange={(e) => handleMono(baseColor, parseInt(e.target.value))}
              className="flex-1 accent-[#B8963E]"
            />
            <span className="font-mono text-xs text-neutral-400 w-6 text-right">{shadeCount}</span>
          </div>
          <div className="flex gap-0.5 flex-wrap">
            {colors.map((c, i) => (
              <span key={i} className="w-6 h-6" style={{ background: c, borderRadius: 0 }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-1 flex-wrap items-center">
            {colors.map((c, i) => (
              <div key={i} className="relative group">
                <input
                  type="color"
                  value={c}
                  onChange={(e) => updateColor(i, e.target.value)}
                  className="w-8 h-8 border border-neutral-700 bg-transparent cursor-pointer"
                  style={{ borderRadius: 0 }}
                />
                {colors.length > 1 && (
                  <button
                    onClick={() => removeColor(i)}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-neutral-900 border border-neutral-700 text-neutral-500 text-[8px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ borderRadius: 0 }}
                  >
                    x
                  </button>
                )}
              </div>
            ))}
            {colors.length < 24 && (
              <button
                onClick={addColor}
                className="w-8 h-8 border border-dashed border-neutral-700 text-neutral-600 hover:text-[#B8963E] hover:border-[#B8963E] flex items-center justify-center text-lg transition-colors"
                style={{ borderRadius: 0 }}
              >
                +
              </button>
            )}
          </div>
          <p className="font-mono text-[10px] text-neutral-600">
            Click swatch to change color. Hover to remove. Up to 24 colors.
          </p>
        </div>
      )}
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

/* ── 15. Typographic Chaos ── */
function TypographicChaosDemo() {
  const { ref, inView } = useInView();
  const palette = usePalette();
  const chaos = useChaos();
  const resolved = chaos.resolved;
  const displayText = resolved.textTransform === "uppercase" ? resolved.text.toUpperCase()
    : resolved.textTransform === "lowercase" ? resolved.text.toLowerCase() : resolved.text;
  const text = displayText;
  type LS = { fontFamily: string; fontWeight: number; fontSize: number; rotate: number; skewX: number; color: string; letterSpacing: number; scaleY: number; scaleX: number; fontStyle: string; fontVariantCaps: string; verticalAlign: string };
  const [letterStates, setLetterStates] = useState<LS[]>([]);

  const fonts = [
    "var(--font-playfair)", "var(--font-inter)", "var(--font-source-sans)",
    "monospace", "serif", "sans-serif", "cursive", "fantasy",
    "Georgia", "Courier New", "Impact", "Times New Roman",
    "Palatino", "Garamond", "Trebuchet MS", "Arial Black", "Bookman",
  ];
  const weights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  const variantCaps = ["normal", "small-caps", "all-small-caps", "petite-caps", "unicase", "titling-caps"];
  const vAligns = ["baseline", "super", "sub", "text-top"];

  const res: LS = {
    fontFamily: resolved.fontFamily, fontWeight: resolved.fontWeight,
    fontSize: resolved.fontSize, rotate: 0, skewX: 0, color: resolved.color,
    letterSpacing: resolved.letterSpacing, scaleY: 1, scaleX: 1,
    fontStyle: "normal", fontVariantCaps: "normal", verticalAlign: "baseline",
  };

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const reg = chaos.regularity / 100; // 0 = full chaos, 1 = resolved
  // Speed: 1=200ms, 5=80ms, 10=30ms
  const tickMs = Math.round(200 - (chaos.speed - 1) * 19);

  const randomForLetter = useCallback((i: number): LS => {
    if (chaos.lockedLetters.has(i)) return res;
    const r = reg;
    // Blend: at regularity 0, fully random. At 100, fully resolved.
    // In between, reduce the magnitude of deviation
    const dev = 1 - r;
    return {
      fontFamily: dev > 0.2 ? fonts[Math.floor(Math.random() * fonts.length)] : res.fontFamily,
      fontWeight: dev > 0.1 ? weights[Math.floor(Math.random() * weights.length)] : res.fontWeight,
      fontSize: lerp(res.fontSize, 14 + Math.random() * 50, dev),
      rotate: lerp(0, -45 + Math.random() * 90, dev),
      skewX: lerp(0, -20 + Math.random() * 40, dev),
      color: dev > 0.05 ? palette.colors[Math.floor(Math.random() * palette.colors.length)] : res.color,
      letterSpacing: lerp(res.letterSpacing, -5 + Math.random() * 15, dev),
      scaleY: 1,
      scaleX: lerp(1, 0.5 + Math.random() * 1.5, dev),
      fontStyle: dev > 0.3 && Math.random() > 0.6 ? "italic" : "normal",
      fontVariantCaps: dev > 0.4 ? variantCaps[Math.floor(Math.random() * variantCaps.length)] : "normal",
      verticalAlign: "baseline",
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette.colors, reg, chaos.lockedLetters, resolved]);

  useEffect(() => {
    if (!inView) return;
    const iv = setInterval(() => {
      setLetterStates(text.split("").map((_, i) => randomForLetter(i)));
    }, tickMs);
    return () => clearInterval(iv);
  }, [inView, tickMs, text, randomForLetter]);

  // Init
  useEffect(() => {
    setLetterStates(text.split("").map(() => res));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div ref={ref} className="w-full flex justify-center items-center min-h-[140px] overflow-visible">
      <div style={{ whiteSpace: "nowrap", display: "flex", alignItems: "baseline" }}>
        {text.split("").map((ch, i) => {
          const s = letterStates[i] || res;
          const locked = chaos.lockedLetters.has(i);
          return (
            /* Outer: fixed size from resolved font, holds layout */
            <span
              key={i}
              onClick={() => chaos.toggleLock(i)}
              style={{
                display: "inline-block",
                fontFamily: resolved.fontFamily,
                fontWeight: resolved.fontWeight,
                fontSize: `${resolved.fontSize}px`,
                color: "transparent",
                lineHeight: 1,
                position: "relative",
                cursor: "pointer",
                flexShrink: 0,
                borderBottom: locked ? "2px solid #B8963E" : "2px solid transparent",
              }}
            >
              {ch}
              {/* Chaos letter overlaid */}
              <span
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  display: "inline-block",
                  fontFamily: s.fontFamily,
                  fontWeight: s.fontWeight,
                  fontSize: `${s.fontSize}px`,
                  fontStyle: s.fontStyle,
                  fontVariantCaps: s.fontVariantCaps as never,
                  color: s.color,
                  transform: `translate(-50%, -50%) rotate(${s.rotate}deg) skewX(${s.skewX}deg) scaleX(${s.scaleX})`,
                  letterSpacing: `${s.letterSpacing}px`,
                  transition: locked
                    ? "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)"
                    : "all 0.06s linear",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}
              >
                {ch}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ── 16. Combinatorial Storm ── */
function CombinatorialStormDemo() {
  const { ref, inView } = useInView();
  const palette = usePalette();
  const text = "TOTAL CHAOS";
  const [letterStates, setLetterStates] = useState<Array<Record<string, string | number>>>([]);

  const fonts = [
    "var(--font-playfair)", "var(--font-inter)", "var(--font-source-sans)",
    "monospace", "serif", "sans-serif", "cursive", "fantasy",
    "Georgia", "Impact", "Courier New", "Times New Roman",
    "Palatino", "Garamond", "Bookman", "Trebuchet MS", "Arial Black",
  ];
  const variants = [
    "normal", "small-caps", "all-small-caps", "petite-caps",
    "all-petite-caps", "unicase", "titling-caps",
  ];
  const decorations = ["none", "underline", "line-through", "overline", "underline line-through"];
  // verticalAligns removed — letters stay on baseline
  const featureSettings = [
    "normal",
    "'liga' 1", "'liga' 0",
    "'smcp' 1", "'c2sc' 1",
    "'onum' 1", "'lnum' 1",
    "'swsh' 1", "'salt' 1",
    "'frac' 1", "'zero' 1",
    "'ss01' 1", "'ss02' 1", "'ss03' 1",
  ];

  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const randomize = useCallback((): Record<string, string | number>[] => {
    return text.split("").map((ch): Record<string, string | number> => {
      if (ch === " ") return { isSpace: 1 };
      return {
        isSpace: 0,
        fontFamily: pick(fonts),
        fontWeight: 100 + Math.floor(Math.random() * 9) * 100,
        fontSize: 10 + Math.random() * 44,
        fontStyle: Math.random() > 0.6 ? "italic" : "normal",
        fontVariant: pick(variants),
        fontFeatureSettings: pick(featureSettings),
        color: pick(palette.colors),
        rotate: -25 + Math.random() * 50,
        y: 0,
        scaleX: 0.6 + Math.random() * 1.0,
        scaleY: 1,
        skewX: -15 + Math.random() * 30,
        textDecoration: pick(decorations),
        verticalAlign: "baseline",
        letterSpacing: -3 + Math.random() * 8,
        opacity: 0.5 + Math.random() * 0.5,
        textShadow: Math.random() > 0.7 ? 1 : 0,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!inView) return;
    const iv = setInterval(() => {
      setLetterStates(randomize());
    }, 90);
    return () => clearInterval(iv);
  }, [inView, randomize]);

  useEffect(() => {
    setLetterStates(randomize());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className="w-full flex justify-center items-center min-h-[120px] overflow-hidden">
      <div style={{ whiteSpace: "nowrap", display: "flex", alignItems: "baseline" }}>
        {text.split("").map((ch, i) => {
          const s = letterStates[i] || { isSpace: 0 };
          if (ch === " " || s.isSpace === 1) return <span key={i} style={{ width: "0.35em", flexShrink: 0 }}>&nbsp;</span>;
          const hasShadow = s.textShadow === 1;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                fontFamily: s.fontFamily as string,
                fontWeight: s.fontWeight as number,
                fontSize: `${s.fontSize}px`,
                fontStyle: s.fontStyle as string,
                fontVariantCaps: s.fontVariant as never,
                fontFeatureSettings: s.fontFeatureSettings as string,
                color: s.color as string,
                transform: `rotate(${s.rotate}deg) scaleX(${s.scaleX}) skewX(${s.skewX}deg)`,
                textDecoration: s.textDecoration as string,
                verticalAlign: s.verticalAlign as string,
                letterSpacing: `${s.letterSpacing}px`,
                opacity: s.opacity as number,
                textShadow: hasShadow ? `0 0 8px ${s.color}` : "none",
                lineHeight: 1,
                transition: "none",
                flexShrink: 0,
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ── 17. Entropy Collapse ── */
function EntropyCollapseDemo() {
  const { ref, inView } = useInView();
  const palette = usePalette();
  const resolved = useResolved();
  const displayText = resolved.textTransform === "uppercase" ? resolved.text.toUpperCase()
    : resolved.textTransform === "lowercase" ? resolved.text.toLowerCase() : resolved.text;
  const text = displayText;
  const totalDuration = 30000; // 30 seconds
  const tickMs = 80;
  const startTimeRef = useRef(0);
  const [letterStates, setLetterStates] = useState<Array<Record<string, string | number>>>([]);
  const [globalEntropy, setGlobalEntropy] = useState(1);
  const [phase, setPhase] = useState<"chaos" | "hold">("chaos");

  const fonts = [
    "var(--font-playfair)", "var(--font-inter)", "var(--font-source-sans)",
    "monospace", "serif", "cursive", "Georgia", "Impact",
    "Courier New", "Times New Roman", "Palatino", "Arial Black",
  ];
  const variantCaps = ["normal", "small-caps", "all-small-caps", "unicase"];
  const vAligns = ["baseline", "super", "sub"];
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const resolvedStyle = useCallback((): Record<string, string | number> => ({
    fontFamily: resolved.fontFamily,
    fontWeight: resolved.fontWeight,
    fontSize: resolved.fontSize,
    fontStyle: "normal",
    fontVariant: "normal",
    verticalAlign: "baseline",
    color: resolved.color,
    rotate: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    skewX: 0,
    letterSpacing: resolved.letterSpacing,
    opacity: 1,
    isSpace: 0,
  }), [resolved]);

  // Generate a letter style that's interpolated toward resolved based on
  // the letter's own entropy level, but with random noise
  const chaoticStyle = useCallback((letterEntropy: number): Record<string, string | number> => {
    const e = letterEntropy;
    if (e < 0.02) return resolvedStyle();
    return {
      fontFamily: e > 0.2 ? pick(fonts) : "var(--font-playfair)",
      fontWeight: Math.round(700 + e * (Math.random() - 0.5) * 800),
      fontSize: 34 + e * (Math.random() * 40 - 20),
      fontStyle: e > 0.3 && Math.random() > 0.6 ? "italic" : "normal",
      fontVariant: e > 0.4 ? pick(variantCaps) : "normal",
      verticalAlign: "baseline",
      color: e > 0.05
        ? palette.colors[Math.floor(Math.random() * palette.colors.length)]
        : "#B8963E",
      rotate: e * (Math.random() - 0.5) * 70,
      y: 0,
      scaleX: 1 + e * (Math.random() - 0.5) * 1.2,
      scaleY: 1,
      skewX: e * (Math.random() - 0.5) * 30,
      letterSpacing: 3 + e * (Math.random() - 0.5) * 10,
      opacity: 1 - e * Math.random() * 0.4,
      isSpace: 0,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!inView) return;
    startTimeRef.current = Date.now();
    setPhase("chaos");
    setGlobalEntropy(1);

    const iv = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(1, elapsed / totalDuration);

      // Base entropy decreases over 30s, but non-linearly
      // Use a curve that's steep at first, slow in the middle, then finishes
      const baseEntropy = 1 - progress;

      // Per-letter entropy: each letter gets its own convergence rate
      // Some letters "find themselves" early, others fight it
      const states = text.split("").map((ch, i): Record<string, string | number> => {
        if (ch === " ") return { isSpace: 1 };

        // Each letter has a different convergence personality
        const letterPhase = ((i * 3 + 7) % text.replace(/ /g, "").length) / text.replace(/ /g, "").length;
        // Some letters lead, some lag
        const letterProgress = Math.min(1, progress * (0.6 + letterPhase * 0.8));
        let letterEntropy = 1 - letterProgress;

        // CHAOS in the process: random spikes back toward chaos
        // More frequent and larger at the start, diminishing over time
        if (Math.random() < baseEntropy * 0.4) {
          letterEntropy = Math.min(1, letterEntropy + Math.random() * baseEntropy * 0.6);
        }

        // Occasional "glitch" — letter that was almost resolved snaps back
        if (letterEntropy < 0.3 && Math.random() < 0.08 * baseEntropy) {
          letterEntropy = 0.4 + Math.random() * 0.3;
        }

        return chaoticStyle(letterEntropy);
      });

      setLetterStates(states);
      setGlobalEntropy(baseEntropy);

      // Done — hold for 3s then restart
      if (progress >= 1) {
        clearInterval(iv);
        setPhase("hold");
        setTimeout(() => {
          startTimeRef.current = Date.now();
          setPhase("chaos");
          setGlobalEntropy(1);
        }, 3000);
      }
    }, tickMs);

    return () => clearInterval(iv);
  }, [inView, phase, chaoticStyle, resolvedStyle]);

  // Init
  useEffect(() => {
    setLetterStates(text.split("").map((ch) =>
      ch === " " ? { isSpace: 1 } : chaoticStyle(1)
    ));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const elapsed = phase === "hold" ? 30 : Math.round((1 - globalEntropy) * 30);

  return (
    <div ref={ref} className="w-full flex flex-col items-center min-h-[180px] justify-center gap-4 overflow-hidden">
      <div style={{ whiteSpace: "nowrap", display: "flex", alignItems: "baseline" }}>
        {text.split("").map((ch, i) => {
          const s = letterStates[i] || { isSpace: ch === " " ? 1 : 0 };
          if (ch === " " || s.isSpace === 1) return <span key={i} style={{ width: "0.4em", flexShrink: 0 }}>&nbsp;</span>;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                fontFamily: s.fontFamily as string || "var(--font-playfair)",
                fontWeight: s.fontWeight as number || 700,
                fontSize: `${s.fontSize || 34}px`,
                fontStyle: (s.fontStyle as string) || "normal",
                fontVariantCaps: s.fontVariant as never,
                verticalAlign: (s.verticalAlign as string) || "baseline",
                color: (s.color as string) || "#B8963E",
                transform: `rotate(${s.rotate || 0}deg) scaleX(${s.scaleX || 1}) skewX(${s.skewX || 0}deg)`,
                letterSpacing: `${s.letterSpacing || 3}px`,
                opacity: s.opacity as number || 1,
                transition: "none",
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
      <div className="w-64 h-1 bg-neutral-800 relative">
        <div
          className="h-full bg-[#B8963E]"
          style={{ width: `${(1 - globalEntropy) * 100}%`, transition: "width 0.08s linear" }}
        />
      </div>
      <p className="text-xs font-mono text-neutral-600 tabular-nums">
        {phase === "hold"
          ? `Resolved -- ${resolved.fontFamilyLabel}, ${resolved.fontWeight}`
          : `${elapsed}s / 30s -- ${globalEntropy > 0.6 ? "Pure chaos" : globalEntropy > 0.3 ? "Fighting for order" : globalEntropy > 0.1 ? "Almost there" : "Converging..."}`
        }
      </p>
    </div>
  );
}

/* ── 18. Font Clash ── */
const GOOGLE_FONTS_CLASH = [
  { name: "Playfair Display", family: "var(--font-playfair)", isSystem: true },
  { name: "Inter", family: "var(--font-inter)", isSystem: true },
  { name: "Source Sans 3", family: "var(--font-source-sans)", isSystem: true },
  { name: "Georgia", family: "Georgia, serif", isSystem: true },
  { name: "Times New Roman", family: "'Times New Roman', serif", isSystem: true },
  { name: "Courier New", family: "'Courier New', monospace", isSystem: true },
  { name: "Impact", family: "Impact, sans-serif", isSystem: true },
  { name: "Trebuchet MS", family: "'Trebuchet MS', sans-serif", isSystem: true },
  { name: "Palatino", family: "Palatino, serif", isSystem: true },
  { name: "Arial Black", family: "'Arial Black', sans-serif", isSystem: true },
  { name: "Garamond", family: "Garamond, serif", isSystem: true },
  // Google Fonts (loaded dynamically)
  { name: "Bebas Neue", family: "'Bebas Neue', sans-serif", isSystem: false },
  { name: "Oswald", family: "'Oswald', sans-serif", isSystem: false },
  { name: "Lora", family: "'Lora', serif", isSystem: false },
  { name: "Merriweather", family: "'Merriweather', serif", isSystem: false },
  { name: "Raleway", family: "'Raleway', sans-serif", isSystem: false },
  { name: "Montserrat", family: "'Montserrat', sans-serif", isSystem: false },
  { name: "Roboto Slab", family: "'Roboto Slab', serif", isSystem: false },
  { name: "Dancing Script", family: "'Dancing Script', cursive", isSystem: false },
  { name: "Permanent Marker", family: "'Permanent Marker', cursive", isSystem: false },
  { name: "Abril Fatface", family: "'Abril Fatface', serif", isSystem: false },
  { name: "Righteous", family: "'Righteous', sans-serif", isSystem: false },
  { name: "Cinzel", family: "'Cinzel', serif", isSystem: false },
  { name: "Bungee", family: "'Bungee', sans-serif", isSystem: false },
  { name: "Archivo Black", family: "'Archivo Black', sans-serif", isSystem: false },
  { name: "Cormorant Garamond", family: "'Cormorant Garamond', serif", isSystem: false },
  { name: "Staatliches", family: "'Staatliches', sans-serif", isSystem: false },
  { name: "Alfa Slab One", family: "'Alfa Slab One', serif", isSystem: false },
  { name: "Sacramento", family: "'Sacramento', cursive", isSystem: false },
  { name: "Zilla Slab", family: "'Zilla Slab', serif", isSystem: false },
];

function FontClashPicker({ selected, onChange }: {
  selected: string[];
  onChange: (fonts: string[]) => void;
}) {
  const toggle = (family: string) => {
    if (selected.includes(family)) {
      if (selected.length <= 2) return; // minimum 2 fonts
      onChange(selected.filter(f => f !== family));
    } else {
      onChange([...selected, family]);
    }
  };

  return (
    <div className="mb-6 p-6 border border-neutral-800 bg-neutral-950/50">
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">
          Font Mix ({selected.length} selected — min 2)
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => onChange(GOOGLE_FONTS_CLASH.map(f => f.family))}
            className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-[#B8963E] border border-neutral-800 hover:border-[#B8963E] px-2 py-0.5 transition-colors"
            style={{ borderRadius: 0 }}
          >
            All
          </button>
          <button
            onClick={() => onChange(GOOGLE_FONTS_CLASH.filter(f => f.isSystem).slice(0, 3).map(f => f.family))}
            className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-[#B8963E] border border-neutral-800 hover:border-[#B8963E] px-2 py-0.5 transition-colors"
            style={{ borderRadius: 0 }}
          >
            Reset
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {GOOGLE_FONTS_CLASH.map((font) => {
          const active = selected.includes(font.family);
          return (
            <button
              key={font.name}
              onClick={() => toggle(font.family)}
              className={`px-3 py-1.5 border transition-colors ${
                active
                  ? "border-[#B8963E] text-[#B8963E] bg-[#B8963E]/10"
                  : "border-neutral-800 text-neutral-600 hover:text-neutral-400 hover:border-neutral-600"
              }`}
              style={{ borderRadius: 0, fontFamily: font.family, fontSize: "13px" }}
            >
              {font.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FontClashDemo() {
  const { ref, inView } = useInView();
  const chaos = useChaos();
  const palette = usePalette();
  const resolved = chaos.resolved;
  const displayText = resolved.textTransform === "uppercase" ? resolved.text.toUpperCase()
    : resolved.textTransform === "lowercase" ? resolved.text.toLowerCase() : resolved.text;
  const text = displayText;

  // Get fonts from FontClashContext
  const clashFonts = useFontClash();

  type LS = { fontFamily: string; fontWeight: number; fontSize: number; color: string; fontStyle: string };
  const [letterStates, setLetterStates] = useState<LS[]>([]);

  const res: LS = {
    fontFamily: resolved.fontFamily, fontWeight: resolved.fontWeight,
    fontSize: resolved.fontSize, color: resolved.color, fontStyle: "normal",
  };

  const reg = chaos.regularity / 100;
  const tickMs = Math.round(200 - (chaos.speed - 1) * 19);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const randomForLetter = useCallback((i: number): LS => {
    if (chaos.lockedLetters.has(i)) return res;
    const dev = 1 - reg;
    return {
      fontFamily: dev > 0.1 ? pick(clashFonts) : res.fontFamily,
      fontWeight: dev > 0.1 ? pick([300, 400, 500, 600, 700, 800, 900]) : res.fontWeight,
      fontSize: lerp(res.fontSize, res.fontSize * (0.7 + Math.random() * 0.6), dev),
      color: dev > 0.05 ? pick(palette.colors) : res.color,
      fontStyle: dev > 0.3 && Math.random() > 0.7 ? "italic" : "normal",
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette.colors, reg, chaos.lockedLetters, resolved, clashFonts]);

  useEffect(() => {
    if (!inView) return;
    const iv = setInterval(() => {
      setLetterStates(text.split("").map((_, i) => randomForLetter(i)));
    }, tickMs);
    return () => clearInterval(iv);
  }, [inView, tickMs, text, randomForLetter]);

  useEffect(() => {
    setLetterStates(text.split("").map(() => res));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div ref={ref} className="w-full flex justify-center items-center min-h-[140px] overflow-visible">
      <div style={{ whiteSpace: "nowrap", display: "flex", alignItems: "baseline" }}>
        {text.split("").map((ch, i) => {
          const s = letterStates[i] || res;
          const locked = chaos.lockedLetters.has(i);
          return (
            <span
              key={i}
              onClick={() => chaos.toggleLock(i)}
              style={{
                display: "inline-block",
                fontFamily: resolved.fontFamily,
                fontWeight: resolved.fontWeight,
                fontSize: `${resolved.fontSize}px`,
                color: "transparent",
                lineHeight: 1,
                position: "relative",
                cursor: "pointer",
                flexShrink: 0,
                borderBottom: locked ? "2px solid #B8963E" : "2px solid transparent",
              }}
            >
              {ch}
              <span
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  display: "inline-block",
                  fontFamily: s.fontFamily,
                  fontWeight: s.fontWeight,
                  fontSize: `${s.fontSize}px`,
                  fontStyle: s.fontStyle,
                  color: s.color,
                  transform: "translate(-50%, -50%)",
                  transition: locked
                    ? "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)"
                    : "all 0.06s linear",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}
              >
                {ch}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

const FontClashContext = createContext<string[]>([]);
function useFontClash() { return useContext(FontClashContext); }

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
  typographicChaos: {
    css: `/* Typographic Chaos — controllable per-letter randomization */
.typo-chaos {
  display: flex;
  align-items: baseline;   /* all letters share one baseline */
  white-space: nowrap;
}
.typo-chaos .letter {
  display: inline-block;
  line-height: 1;
  cursor: pointer;          /* click to lock/unlock */
  transition: none;         /* no smoothing during chaos */
}
.typo-chaos .letter.locked {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  border-bottom: 2px solid currentColor;
}

/* Controls via CSS custom properties:
   --chaos-speed: interval in ms (30-200)
   --chaos-regularity: 0-1 (0 = full chaos, 1 = resolved)
   Set these from JS or a range input */`,
    react: `// Configurable typographic chaos with speed, regularity, and per-letter locking
type ChaosConfig = {
  text: string;
  colors: string[];                // palette of allowed colors
  resolved: {                      // target "resolved" style
    fontFamily: string; fontWeight: number; fontSize: number;
    color: string; letterSpacing: number;
  };
  speed: number;                   // 1-10 (1=glacial, 10=insane)
  regularity: number;              // 0-100 (0=chaos, 100=resolved)
};

function TypographicChaos({ text, colors, resolved, speed, regularity }: ChaosConfig) {
  const [states, setStates] = useState<Record<string, any>[]>([]);
  const [locked, setLocked] = useState<Set<number>>(new Set());
  
  const fonts = ["serif", "sans-serif", "monospace", "cursive",
    "Impact", "Georgia", "Palatino", "Courier New"];
  const variants = ["normal", "small-caps", "all-small-caps", "unicase"];
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  
  const tickMs = Math.round(200 - (speed - 1) * 19);
  const dev = 1 - regularity / 100;   // deviation factor
  
  const randomize = (i: number) => {
    if (locked.has(i)) return {          // locked = resolved
      ...resolved, rotate: 0, skewX: 0, scaleX: 1,
      fontStyle: "normal", fontVariantCaps: "normal",
    };
    return {
      fontFamily: dev > 0.2 ? pick(fonts) : resolved.fontFamily,
      fontWeight: dev > 0.1 ? pick([100,200,300,400,500,600,700,800,900]) : resolved.fontWeight,
      fontSize: lerp(resolved.fontSize, 14 + Math.random() * 50, dev),
      rotate: lerp(0, (Math.random() - 0.5) * 90, dev),
      skewX: lerp(0, (Math.random() - 0.5) * 40, dev),
      color: dev > 0.05 ? pick(colors) : resolved.color,
      letterSpacing: lerp(resolved.letterSpacing, -5 + Math.random() * 15, dev),
      scaleX: lerp(1, 0.5 + Math.random() * 1.5, dev),
      fontStyle: dev > 0.3 && Math.random() > 0.6 ? "italic" : "normal",
      fontVariantCaps: dev > 0.4 ? pick(variants) : "normal",
    };
  };
  
  useEffect(() => {
    const iv = setInterval(() => {
      setStates(text.split("").map((_, i) => randomize(i)));
    }, tickMs);
    return () => clearInterval(iv);
  }, [tickMs, text, dev, locked]);

  const toggle = (i: number) => setLocked(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  return (
    <div style={{ display: "flex", alignItems: "baseline", whiteSpace: "nowrap" }}>
      {text.split("").map((ch, i) => {
        const s = states[i] || {};
        const isLocked = locked.has(i);
        return (
          <span key={i} onClick={() => toggle(i)} style={{
            display: "inline-block", cursor: "pointer", lineHeight: 1,
            fontFamily: s.fontFamily, fontWeight: s.fontWeight,
            fontSize: (s.fontSize || 36) + "px", color: s.color,
            fontStyle: s.fontStyle, fontVariantCaps: s.fontVariantCaps,
            letterSpacing: (s.letterSpacing || 0) + "px",
            transform: \`rotate(\${s.rotate||0}deg) skewX(\${s.skewX||0}deg) scaleX(\${s.scaleX||1})\`,
            transition: isLocked ? "all 0.3s cubic-bezier(0.34,1.56,0.64,1)" : "none",
            borderBottom: isLocked ? "2px solid currentColor" : "none",
          }}>{ch}</span>
        );
      })}
    </div>
  );
}`,
  },
  combinatorialStorm: {
    css: `/* Combinatorial Storm — every property randomized, baseline locked */
.storm {
  display: flex;
  align-items: baseline;
  white-space: nowrap;
}
.storm .letter {
  display: inline-block;
  line-height: 1;
  transition: none;    /* raw chaos, no smoothing */
}
/* Mutated per-letter at ~11fps via JS:
   font-family, weight, size, style, variant-caps,
   OpenType features, color, rotation, scaleX, skew,
   text-decoration, opacity, glow shadows */`,
    react: `function CombinatorialStorm({ text = "TOTAL CHAOS", colors }: {
  text?: string; colors: string[];
}) {
  const fonts = ["serif", "sans-serif", "monospace", "cursive",
    "Georgia", "Impact", "Courier New", "Palatino", "Arial Black"];
  const variants = ["normal", "small-caps", "all-small-caps", "unicase"];
  const features = ["normal", "'smcp' 1", "'onum' 1", "'swsh' 1", "'salt' 1"];
  const decorations = ["none", "underline", "line-through"];
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

  const randomize = () => text.split("").map(ch => {
    if (ch === " ") return { isSpace: true };
    return {
      fontFamily: pick(fonts),
      fontWeight: 100 + Math.floor(Math.random() * 9) * 100,
      fontSize: 10 + Math.random() * 44,
      fontStyle: Math.random() > 0.6 ? "italic" : "normal",
      fontVariantCaps: pick(variants),
      fontFeatureSettings: pick(features),
      color: pick(colors),
      rotate: -25 + Math.random() * 50,
      scaleX: 0.6 + Math.random() * 1.0,
      skewX: -15 + Math.random() * 30,
      textDecoration: pick(decorations),
      opacity: 0.5 + Math.random() * 0.5,
    };
  });

  const [states, setStates] = useState(randomize());

  useEffect(() => {
    const iv = setInterval(() => setStates(randomize()), 90);
    return () => clearInterval(iv);
  }, [colors]);

  return (
    <div style={{ display: "flex", alignItems: "baseline", whiteSpace: "nowrap" }}>
      {text.split("").map((ch, i) => {
        const s = states[i] as any;
        if (ch === " " || s?.isSpace) return <span key={i} style={{ width: "0.35em" }}> </span>;
        return (
          <span key={i} style={{
            display: "inline-block", lineHeight: 1,
            fontFamily: s.fontFamily, fontWeight: s.fontWeight,
            fontSize: s.fontSize + "px", fontStyle: s.fontStyle,
            fontVariantCaps: s.fontVariantCaps,
            fontFeatureSettings: s.fontFeatureSettings,
            color: s.color, opacity: s.opacity,
            textDecoration: s.textDecoration,
            transform: \`rotate(\${s.rotate}deg) scaleX(\${s.scaleX}) skewX(\${s.skewX}deg)\`,
          }}>{ch}</span>
        );
      })}
    </div>
  );
}`,
  },
  entropyCollapse: {
    css: `/* 30-second entropy collapse — chaos to order, baseline locked */
.entropy {
  display: flex;
  align-items: baseline;
  white-space: nowrap;
}
.entropy .letter {
  display: inline-block;
  line-height: 1;
  transition: none;   /* raw per-tick updates, no smoothing */
}
/* Each letter has its own convergence rate —
   some find order early, others fight it.
   Random "glitch" spikes push letters back toward chaos.
   Progress bar + timer show the 30s journey. */`,
    react: `// 30-second journey from chaos to resolved target style
function EntropyCollapse({ text, colors, resolved }: {
  text: string; colors: string[];
  resolved: { fontFamily: string; fontWeight: number; fontSize: number;
    color: string; letterSpacing: number };
}) {
  const [states, setStates] = useState<Record<string, any>[]>([]);
  const [entropy, setEntropy] = useState(1);
  const startRef = useRef(Date.now());
  const fonts = ["serif", "monospace", "Impact", "Georgia", "cursive",
    "sans-serif", "Courier New", "Palatino"];
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

  useEffect(() => {
    startRef.current = Date.now();
    const iv = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const progress = Math.min(1, elapsed / 30000);
      const baseE = 1 - progress;
      setEntropy(baseE);

      setStates(text.split("").map((ch, i) => {
        if (ch === " ") return { isSpace: true };
        // Per-letter convergence personality
        const phase = ((i * 3 + 7) % text.replace(/ /g, "").length)
          / text.replace(/ /g, "").length;
        let e = 1 - Math.min(1, progress * (0.6 + phase * 0.8));
        // Random chaos spikes
        if (Math.random() < baseE * 0.4)
          e = Math.min(1, e + Math.random() * baseE * 0.6);
        if (e < 0.02) return { ...resolved, rotate: 0, scaleX: 1, skewX: 0 };
        return {
          fontFamily: e > 0.2 ? pick(fonts) : resolved.fontFamily,
          fontWeight: Math.round(resolved.fontWeight + e * (Math.random()-0.5) * 800),
          fontSize: resolved.fontSize + e * (Math.random() * 40 - 20),
          color: e > 0.05 ? pick(colors) : resolved.color,
          rotate: e * (Math.random()-0.5) * 70,
          scaleX: 1 + e * (Math.random()-0.5) * 1.2,
          skewX: e * (Math.random()-0.5) * 30,
          letterSpacing: resolved.letterSpacing + e * (Math.random()-0.5) * 10,
        };
      }));

      if (progress >= 1) {
        clearInterval(iv);
        setTimeout(() => { startRef.current = Date.now(); }, 3000);
      }
    }, 80);
    return () => clearInterval(iv);
  }, [text, colors, resolved]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", whiteSpace: "nowrap",
        justifyContent: "center" }}>
        {text.split("").map((ch, i) => {
          const s = (states[i] as any) || {};
          if (ch === " " || s.isSpace) return <span key={i} style={{ width: "0.4em" }}> </span>;
          return (
            <span key={i} style={{
              display: "inline-block", lineHeight: 1,
              fontFamily: s.fontFamily, fontWeight: s.fontWeight,
              fontSize: (s.fontSize||34)+"px", color: s.color,
              letterSpacing: (s.letterSpacing||0)+"px",
              transform: \`rotate(\${s.rotate||0}deg) scaleX(\${s.scaleX||1}) skewX(\${s.skewX||0}deg)\`,
            }}>{ch}</span>
          );
        })}
      </div>
      <div style={{ width: 256, height: 4, background: "#262626", margin: "16px auto" }}>
        <div style={{ height: "100%", width: (1-entropy)*100+"%",
          background: "#B8963E", transition: "width 80ms linear" }} />
      </div>
    </div>
  );
}`,
  },
};

/* ═════════════════════════════════════════════
   EXPERIMENTAL SECTION (with palette picker)
   ═════════════════════════════════════════════ */

function ExperimentalSection() {
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [resolvedStyle, setResolvedStyle] = useState<ResolvedStyle>(DEFAULT_RESOLVED);
  const [speed, setSpeed] = useState(5);
  const [regularity, setRegularity] = useState(0);
  const [lockedLetters, setLockedLetters] = useState<Set<number>>(new Set());
  const [clashFonts, setClashFonts] = useState<string[]>([
    "var(--font-playfair)", "var(--font-inter)", "var(--font-source-sans)",
    "Georgia, serif", "'Courier New', monospace", "Impact, sans-serif",
  ]);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Load Google Fonts when needed
  useEffect(() => {
    const googleFonts = GOOGLE_FONTS_CLASH.filter(f => !f.isSystem && clashFonts.includes(f.family));
    if (googleFonts.length === 0) return;
    if (fontsLoaded) return;
    const families = GOOGLE_FONTS_CLASH.filter(f => !f.isSystem).map(f => f.name.replace(/ /g, "+") + ":wght@300;400;500;600;700;800;900").join("&family=");
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
    document.head.appendChild(link);
    setFontsLoaded(true);
  }, [clashFonts, fontsLoaded]);

  const toggleLock = useCallback((i: number) => {
    setLockedLetters(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }, []);

  const chaosControls: ChaosControls = {
    resolved: resolvedStyle, speed, regularity, lockedLetters, toggleLock,
  };

  const colorsStr = JSON.stringify(colors, null, 2);
  const r = resolvedStyle;
  const tickMs = Math.round(200 - (speed - 1) * 19);

  const clashFontsStr = JSON.stringify(clashFonts, null, 2);

  const dynamicCss = {
    chaos: `/* Typographic Chaos — your configuration */
:root {
  /* Colors: ${colors.join(", ")} */
  /* Resolved: ${r.fontFamilyLabel} ${r.fontWeight} ${r.fontSize}px ${r.color} */
  /* Speed: ${tickMs}ms tick | Regularity: ${regularity}% */
}
.typo-chaos {
  display: flex;
  align-items: baseline;
  white-space: nowrap;
}
.typo-chaos .letter {
  display: inline-block;
  line-height: 1;
  cursor: pointer;
  transition: all 0.06s linear;
}
.typo-chaos .letter.locked {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  border-bottom: 2px solid currentColor;
}
/* Resolved state for each letter: */
.typo-chaos .letter.resolved {
  font-family: ${r.fontFamily.replace(/var\(--font-(\w+)\)/, "'$1'")};
  font-weight: ${r.fontWeight};
  font-size: ${r.fontSize}px;
  color: ${r.color};
  letter-spacing: ${r.letterSpacing}px;${r.textTransform !== "none" ? `\n  text-transform: ${r.textTransform};` : ""}
}`,
    storm: `/* Combinatorial Storm — your palette */
:root {
  /* Colors: ${colors.join(", ")} */
}
.storm {
  display: flex;
  align-items: baseline;
  white-space: nowrap;
}
.storm .letter {
  display: inline-block;
  line-height: 1;
  transition: none;
}`,
    entropy: `/* Entropy Collapse — 30s chaos to order */
:root {
  /* Colors: ${colors.join(", ")} */
  /* Target: ${r.fontFamilyLabel} ${r.fontWeight} ${r.fontSize}px ${r.color} */
}
.entropy {
  display: flex;
  align-items: baseline;
  white-space: nowrap;
}
.entropy .letter {
  display: inline-block;
  line-height: 1;
  transition: none;
}`,
    fontClash: `/* Font Clash — pure font diversity, no gimmicks */
:root {
  /* Fonts: ${clashFonts.map(f => f.split(",")[0].replace(/'/g, "")).join(", ")} */
  /* Colors: ${colors.join(", ")} */
  /* Resolved: ${r.fontFamilyLabel} ${r.fontWeight} ${r.fontSize}px ${r.color} */
}
.font-clash {
  display: flex;
  align-items: baseline;
  white-space: nowrap;
}
.font-clash .letter-container {
  display: inline-block;
  position: relative;
  /* Sized by resolved font — layout never shifts */
  font-family: ${r.fontFamily.replace(/var\(--font-(\w+)\)/, "'$1'")};
  font-weight: ${r.fontWeight};
  font-size: ${r.fontSize}px;
  color: transparent;
}
.font-clash .letter-chaos {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  transition: all 0.06s linear;
}`,
  };

  const resolvedObj = `{ fontFamily: "${r.fontFamily}", fontWeight: ${r.fontWeight}, fontSize: ${r.fontSize}, color: "${r.color}", letterSpacing: ${r.letterSpacing} }`;
  const textVal = r.textTransform === "uppercase" ? r.text.toUpperCase() : r.textTransform === "lowercase" ? r.text.toLowerCase() : r.text;

  const dynamicReact = {
    chaos: `// Your Typographic Chaos configuration
const CONFIG = {
  text: "${textVal}",
  colors: ${colorsStr},
  resolved: ${resolvedObj},
  speed: ${speed},        // tick: ${tickMs}ms
  regularity: ${regularity},   // 0=chaos, 100=resolved
};

function TypographicChaos() {
  const { text, colors, resolved, speed, regularity } = CONFIG;
  const [states, setStates] = useState([]);
  const [locked, setLocked] = useState(new Set());

  const fonts = ["serif", "sans-serif", "monospace", "cursive",
    "Impact", "Georgia", "Palatino", "Courier New"];
  const variants = ["normal", "small-caps", "all-small-caps", "unicase"];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const lerp = (a, b, t) => a + (b - a) * t;

  const tickMs = Math.round(200 - (speed - 1) * 19);
  const dev = 1 - regularity / 100;

  const randomize = (i) => {
    if (locked.has(i)) return {
      ...resolved, rotate: 0, skewX: 0, scaleX: 1,
      fontStyle: "normal", fontVariantCaps: "normal",
    };
    return {
      fontFamily: dev > 0.2 ? pick(fonts) : resolved.fontFamily,
      fontWeight: dev > 0.1 ? pick([100,200,300,400,500,600,700,800,900]) : resolved.fontWeight,
      fontSize: lerp(resolved.fontSize, 14 + Math.random() * 50, dev),
      rotate: lerp(0, (Math.random() - 0.5) * 90, dev),
      skewX: lerp(0, (Math.random() - 0.5) * 40, dev),
      color: dev > 0.05 ? pick(colors) : resolved.color,
      letterSpacing: lerp(resolved.letterSpacing, -5 + Math.random() * 15, dev),
      scaleX: lerp(1, 0.5 + Math.random() * 1.5, dev),
      fontStyle: dev > 0.3 && Math.random() > 0.6 ? "italic" : "normal",
      fontVariantCaps: dev > 0.4 ? pick(variants) : "normal",
    };
  };

  useEffect(() => {
    const iv = setInterval(() => {
      setStates(text.split("").map((_, i) => randomize(i)));
    }, tickMs);
    return () => clearInterval(iv);
  }, [tickMs, locked]);

  const toggle = (i) => setLocked(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  return (
    <div style={{ display: "flex", alignItems: "baseline", whiteSpace: "nowrap" }}>
      {text.split("").map((ch, i) => {
        const s = states[i] || {};
        const isLocked = locked.has(i);
        return (
          <span key={i} onClick={() => toggle(i)} style={{
            display: "inline-block", cursor: "pointer", lineHeight: 1,
            fontFamily: s.fontFamily, fontWeight: s.fontWeight,
            fontSize: (s.fontSize || ${r.fontSize}) + "px", color: s.color,
            fontStyle: s.fontStyle, fontVariantCaps: s.fontVariantCaps,
            letterSpacing: (s.letterSpacing || 0) + "px",
            transform: \`rotate(\${s.rotate||0}deg) skewX(\${s.skewX||0}deg) scaleX(\${s.scaleX||1})\`,
            transition: isLocked ? "all 0.4s cubic-bezier(0.34,1.56,0.64,1)" : "all 0.06s linear",
            borderBottom: isLocked ? "2px solid currentColor" : "none",
          }}>{ch}</span>
        );
      })}
    </div>
  );
}`,
    storm: `// Your Combinatorial Storm configuration
const COLORS = ${colorsStr};

function CombinatorialStorm({ text = "${textVal}" }) {
  const fonts = ["serif", "sans-serif", "monospace", "cursive",
    "Georgia", "Impact", "Courier New", "Palatino", "Arial Black"];
  const variants = ["normal", "small-caps", "all-small-caps", "unicase"];
  const features = ["normal", "'smcp' 1", "'onum' 1", "'swsh' 1", "'salt' 1"];
  const decorations = ["none", "underline", "line-through"];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const randomize = () => text.split("").map(ch => {
    if (ch === " ") return { isSpace: true };
    return {
      fontFamily: pick(fonts), fontWeight: 100 + Math.floor(Math.random()*9)*100,
      fontSize: 10 + Math.random() * 44,
      fontStyle: Math.random() > 0.6 ? "italic" : "normal",
      fontVariantCaps: pick(variants), fontFeatureSettings: pick(features),
      color: pick(COLORS), rotate: -25 + Math.random() * 50,
      scaleX: 0.6 + Math.random(), skewX: -15 + Math.random() * 30,
      textDecoration: pick(decorations), opacity: 0.5 + Math.random() * 0.5,
    };
  });

  const [states, setStates] = useState(randomize());
  useEffect(() => {
    const iv = setInterval(() => setStates(randomize()), 90);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "baseline", whiteSpace: "nowrap" }}>
      {text.split("").map((ch, i) => {
        const s = states[i];
        if (ch === " " || s?.isSpace) return <span key={i} style={{ width: "0.35em" }}> </span>;
        return (
          <span key={i} style={{
            display: "inline-block", lineHeight: 1,
            fontFamily: s.fontFamily, fontWeight: s.fontWeight,
            fontSize: s.fontSize + "px", fontStyle: s.fontStyle,
            fontVariantCaps: s.fontVariantCaps, fontFeatureSettings: s.fontFeatureSettings,
            color: s.color, opacity: s.opacity, textDecoration: s.textDecoration,
            transform: \`rotate(\${s.rotate}deg) scaleX(\${s.scaleX}) skewX(\${s.skewX}deg)\`,
          }}>{ch}</span>
        );
      })}
    </div>
  );
}`,
    entropy: `// Your Entropy Collapse configuration (30s cycle)
const COLORS = ${colorsStr};
const RESOLVED = ${resolvedObj};

function EntropyCollapse({ text = "${textVal}" }) {
  const [states, setStates] = useState([]);
  const [entropy, setEntropy] = useState(1);
  const startRef = useRef(Date.now());
  const fonts = ["serif", "monospace", "Impact", "Georgia", "cursive",
    "sans-serif", "Courier New", "Palatino"];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  useEffect(() => {
    startRef.current = Date.now();
    const iv = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startRef.current) / 30000);
      const baseE = 1 - progress;
      setEntropy(baseE);
      setStates(text.split("").map((ch, i) => {
        if (ch === " ") return { isSpace: true };
        const phase = ((i*3+7) % text.replace(/ /g,"").length) / text.replace(/ /g,"").length;
        let e = 1 - Math.min(1, progress * (0.6 + phase * 0.8));
        if (Math.random() < baseE * 0.4) e = Math.min(1, e + Math.random() * baseE * 0.6);
        if (e < 0.02) return { ...RESOLVED, rotate: 0, scaleX: 1, skewX: 0 };
        return {
          fontFamily: e > 0.2 ? pick(fonts) : RESOLVED.fontFamily,
          fontWeight: Math.round(RESOLVED.fontWeight + e*(Math.random()-0.5)*800),
          fontSize: RESOLVED.fontSize + e*(Math.random()*40-20),
          color: e > 0.05 ? pick(COLORS) : RESOLVED.color,
          rotate: e*(Math.random()-0.5)*70, scaleX: 1+e*(Math.random()-0.5)*1.2,
          skewX: e*(Math.random()-0.5)*30,
          letterSpacing: RESOLVED.letterSpacing + e*(Math.random()-0.5)*10,
        };
      }));
      if (progress >= 1) { clearInterval(iv); setTimeout(() => { startRef.current = Date.now(); }, 3000); }
    }, 80);
    return () => clearInterval(iv);
  }, [text]);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"baseline", whiteSpace:"nowrap", justifyContent:"center" }}>
        {text.split("").map((ch, i) => {
          const s = states[i] || {};
          if (ch === " " || s.isSpace) return <span key={i} style={{ width: "0.4em" }}> </span>;
          return (
            <span key={i} style={{
              display: "inline-block", lineHeight: 1,
              fontFamily: s.fontFamily, fontWeight: s.fontWeight,
              fontSize: (s.fontSize||${r.fontSize})+"px", color: s.color,
              letterSpacing: (s.letterSpacing||0)+"px",
              transform: \`rotate(\${s.rotate||0}deg) scaleX(\${s.scaleX||1}) skewX(\${s.skewX||0}deg)\`,
            }}>{ch}</span>
          );
        })}
      </div>
      <div style={{ width:256, height:4, background:"#262626", margin:"16px auto" }}>
        <div style={{ height:"100%", width:(1-entropy)*100+"%", background:"${r.color}", transition:"width 80ms linear" }} />
      </div>
    </div>
  );
}`,
    fontClash: `// Font Clash — pure font diversity
const FONTS = ${clashFontsStr};
const COLORS = ${colorsStr};
const RESOLVED = ${resolvedObj};

function FontClash({ text = "${textVal}" }) {
  const [states, setStates] = useState([]);
  const [locked, setLocked] = useState(new Set());
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const regularity = ${regularity};
  const speed = ${speed};
  const tickMs = Math.round(200 - (speed - 1) * 19);
  const dev = 1 - regularity / 100;

  const randomize = (i) => {
    if (locked.has(i)) return {
      fontFamily: RESOLVED.fontFamily, fontWeight: RESOLVED.fontWeight,
      fontSize: RESOLVED.fontSize, color: RESOLVED.color, fontStyle: "normal",
    };
    return {
      fontFamily: dev > 0.1 ? pick(FONTS) : RESOLVED.fontFamily,
      fontWeight: dev > 0.1 ? pick([300,400,500,600,700,800,900]) : RESOLVED.fontWeight,
      fontSize: lerp(RESOLVED.fontSize, RESOLVED.fontSize * (0.7 + Math.random() * 0.6), dev),
      color: dev > 0.05 ? pick(COLORS) : RESOLVED.color,
      fontStyle: dev > 0.3 && Math.random() > 0.7 ? "italic" : "normal",
    };
  };

  useEffect(() => {
    const iv = setInterval(() => {
      setStates(text.split("").map((_, i) => randomize(i)));
    }, tickMs);
    return () => clearInterval(iv);
  }, [tickMs, locked]);

  const toggle = (i) => setLocked(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  return (
    <div style={{ display: "flex", alignItems: "baseline", whiteSpace: "nowrap" }}>
      {text.split("").map((ch, i) => {
        const s = states[i] || {};
        const isLocked = locked.has(i);
        return (
          <span key={i} onClick={() => toggle(i)} style={{
            display: "inline-block", position: "relative", cursor: "pointer",
            fontFamily: RESOLVED.fontFamily, fontWeight: RESOLVED.fontWeight,
            fontSize: RESOLVED.fontSize + "px", color: "transparent", lineHeight: 1,
            borderBottom: isLocked ? "2px solid currentColor" : "none",
          }}>
            {ch}
            <span style={{
              position: "absolute", left: "50%", top: "50%",
              display: "inline-block", pointerEvents: "none",
              fontFamily: s.fontFamily, fontWeight: s.fontWeight,
              fontSize: (s.fontSize || RESOLVED.fontSize) + "px",
              fontStyle: s.fontStyle, color: s.color || RESOLVED.color,
              transform: "translate(-50%, -50%)",
              transition: isLocked ? "all 0.4s cubic-bezier(0.34,1.56,0.64,1)" : "all 0.06s linear",
              lineHeight: 1, whiteSpace: "nowrap",
            }}>{ch}</span>
          </span>
        );
      })}
    </div>
  );
}`,
  };

  return (
    <PaletteContext.Provider value={{ colors }}>
    <ChaosContext.Provider value={chaosControls}>
      <section id="experimental" className="border-t border-neutral-800">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            05 -- Experimental
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-16"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Math Experiment Gone Wrong
          </h2>

          <TargetStylePicker style={resolvedStyle} onChange={setResolvedStyle} />
          <ChaosControlsPanel
            speed={speed} onSpeedChange={setSpeed}
            regularity={regularity} onRegularityChange={setRegularity}
            lockedCount={lockedLetters.size}
            onUnlockAll={() => setLockedLetters(new Set())}
          />
          <ColorPaletteBuilder colors={colors} onChange={setColors} />

          <div className="space-y-12">
            <AnimationCard
              name="Typographic Chaos"
              category="Experimental"
              when="404 pages, creative agency portfolios, experimental art sites. Maximum visual disruption."
              whenNot="Anywhere users need to actually read. This is spectacle, not communication."
              Demo={TypographicChaosDemo}
              cssCode={dynamicCss.chaos}
              reactCode={dynamicReact.chaos}
            />
            <AnimationCard
              name="Combinatorial Storm"
              category="Experimental"
              when="Generative art, music visualizers, loading screens where chaos IS the content. Not meant to be read."
              whenNot="Anywhere legibility matters. This is a math experiment gone horribly wrong -- by design."
              Demo={CombinatorialStormDemo}
              cssCode={dynamicCss.storm}
              reactCode={dynamicReact.storm}
            />
            <AnimationCard
              name="Entropy Collapse"
              category="Experimental"
              when="Hero intros, experimental portfolios, the 30-second journey from pure chaos to perfect Playfair -- with actual chaos in the process."
              whenNot="Impatient users. This is a 30-second meditation on typography finding itself."
              Demo={EntropyCollapseDemo}
              cssCode={dynamicCss.entropy}
              reactCode={dynamicReact.entropy}
            />
            <div>
              <FontClashPicker selected={clashFonts} onChange={setClashFonts} />
              <FontClashContext.Provider value={clashFonts}>
                <AnimationCard
                  name="Font Clash"
                  category="Experimental"
                  when="Showcasing font diversity, type specimen pages, creative portfolios. Pure typography — no gimmicks."
                  whenNot="When you need consistency. The beauty here is in the contrast between typefaces."
                  Demo={FontClashDemo}
                  cssCode={dynamicCss.fontClash}
                  reactCode={dynamicReact.fontClash}
                />
              </FontClashContext.Provider>
            </div>
          </div>
        </div>
      </section>
    </ChaosContext.Provider>
    </PaletteContext.Provider>
  );
}

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
          17 typography animations -- from tasteful entrances to pure
          combinatorial chaos. Each one outputs copy-paste code.
        </p>
        <div className="mt-8 flex flex-wrap gap-6 text-xs font-mono uppercase tracking-widest text-neutral-600">
          <a href="#entrances" className="hover:text-[#B8963E] transition-colors">Entrances</a>
          <a href="#emphasis" className="hover:text-[#B8963E] transition-colors">Emphasis</a>
          <a href="#transitions" className="hover:text-[#B8963E] transition-colors">Transitions</a>
          <a href="#scrolling" className="hover:text-[#B8963E] transition-colors">Scrolling</a>
          <a href="#experimental" className="hover:text-[#B8963E] transition-colors">Experimental</a>
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

      {/* ── Experimental ── */}
      <ExperimentalSection />

      {/* ── Footer ── */}
      <footer className="border-t border-neutral-800 py-12 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">
          Built with care for the craft of typography
        </p>
      </footer>
    </main>
  );
}
