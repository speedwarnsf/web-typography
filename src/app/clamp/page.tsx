"use client";

import { useState, useMemo, useCallback } from "react";

/* ── Constants ── */

const RATIOS: Record<string, number> = {
  "Minor Second (1.067)": 1.067,
  "Major Second (1.125)": 1.125,
  "Minor Third (1.200)": 1.200,
  "Major Third (1.250)": 1.250,
  "Perfect Fourth (1.333)": 1.333,
  "Augmented Fourth (1.414)": 1.414,
  "Perfect Fifth (1.500)": 1.500,
  "Golden Ratio (1.618)": 1.618,
};

const SCALE_STEPS = [
  { label: "small", level: -1 },
  { label: "body", level: 0 },
  { label: "h6", level: 1 },
  { label: "h5", level: 2 },
  { label: "h4", level: 3 },
  { label: "h3", level: 4 },
  { label: "h2", level: 5 },
  { label: "h1", level: 6 },
];

const PREVIEW_TEXT: Record<string, string> = {
  h1: "The Art of Typography",
  h2: "Hierarchy and Rhythm",
  h3: "Fluid Type Scaling",
  h4: "Responsive Design",
  h5: "Line Height Matters",
  h6: "Details Count",
  body: "Good typography is invisible. Great typography speaks to the reader without ever being noticed. It carries meaning through form.",
  small: "Caption and metadata text at smaller sizes.",
};

/* ── Math ── */

function computeClamp(
  minFs: number,
  maxFs: number,
  minVw: number,
  maxVw: number,
  unit: "px" | "rem",
  basePx: number
): { clamp: string; slope: number; intercept: number; minVal: string; maxVal: string; preferred: string } {
  const minPx = unit === "rem" ? minFs * basePx : minFs;
  const maxPx = unit === "rem" ? maxFs * basePx : maxFs;

  const slope = (maxPx - minPx) / (maxVw - minVw);
  const intercept = minPx - slope * minVw;

  const slopeVw = +(slope * 100).toFixed(4);
  const interceptRem = +(intercept / basePx).toFixed(4);

  const minRem = +(minPx / basePx).toFixed(4);
  const maxRem = +(maxPx / basePx).toFixed(4);

  const minVal = `${minRem}rem`;
  const maxVal = `${maxRem}rem`;
  const preferred = interceptRem === 0
    ? `${slopeVw}vw`
    : interceptRem > 0
      ? `${slopeVw}vw + ${interceptRem}rem`
      : `${slopeVw}vw - ${Math.abs(interceptRem)}rem`;

  return {
    clamp: `clamp(${minVal}, ${preferred}, ${maxVal})`,
    slope,
    intercept,
    minVal,
    maxVal,
    preferred,
  };
}

function pxAtViewport(minPx: number, slope: number, intercept: number, maxPx: number, vw: number): number {
  const computed = slope * vw + intercept;
  return Math.min(Math.max(computed, minPx), maxPx);
}

/* ── Components ── */

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="px-3 sm:px-4 py-2 text-xs font-mono tracking-wider uppercase border border-[#B8963E] text-[#B8963E] hover:bg-[#B8963E] hover:text-black transition-colors duration-200 shrink-0"
    >
      {copied ? "Copied" : "Copy CSS"}
    </button>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-1">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step || 1}
        className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm font-mono text-neutral-200 outline-none focus:border-[#B8963E] transition-colors"
      />
    </div>
  );
}

/* ── Page ── */

export default function ClampPage() {
  const [minFs, setMinFs] = useState(16);
  const [maxFs, setMaxFs] = useState(24);
  const [minVw, setMinVw] = useState(320);
  const [maxVw, setMaxVw] = useState(1440);
  const [unit, setUnit] = useState<"px" | "rem">("px");
  const [basePx, setBasePx] = useState(16);
  const [previewVw, setPreviewVw] = useState(800);

  const [scaleMode, setScaleMode] = useState(true);
  const [scaleRatio, setScaleRatio] = useState("Major Third (1.250)");
  const [scaleBase, setScaleBase] = useState(16);
  const [scaleMinVw, setScaleMinVw] = useState(320);
  const [scaleMaxVw, setScaleMaxVw] = useState(1440);
  const [scaleShrink, setScaleShrink] = useState(0.75);

  const single = useMemo(
    () => computeClamp(minFs, maxFs, minVw, maxVw, unit, basePx),
    [minFs, maxFs, minVw, maxVw, unit, basePx]
  );

  const singleMinPx = unit === "rem" ? minFs * basePx : minFs;
  const singleMaxPx = unit === "rem" ? maxFs * basePx : maxFs;
  const singlePreviewPx = pxAtViewport(singleMinPx, single.slope, single.intercept, singleMaxPx, previewVw);

  const scaleResults = useMemo(() => {
    const ratio = RATIOS[scaleRatio] || 1.25;
    return SCALE_STEPS.map((step) => {
      const maxSize = scaleBase * Math.pow(ratio, step.level);
      const minSize = scaleBase * Math.pow(ratio, step.level * scaleShrink);
      const result = computeClamp(minSize, maxSize, scaleMinVw, scaleMaxVw, "px", basePx);
      return { ...step, ...result, minPx: minSize, maxPx: maxSize };
    });
  }, [scaleRatio, scaleBase, scaleMinVw, scaleMaxVw, scaleShrink, basePx]);

  const scaleCSS = useMemo(() => {
    const lines = ["/* Fluid Type Scale */", `/* Ratio: ${scaleRatio} */`, `/* Viewport: ${scaleMinVw}px -- ${scaleMaxVw}px */`, ""];
    scaleResults.forEach((s) => {
      lines.push(`/* ${s.label}: ${s.minPx.toFixed(1)}px -- ${s.maxPx.toFixed(1)}px */`);
      lines.push(`--fs-${s.label}: ${s.clamp};`);
    });
    return lines.join("\n");
  }, [scaleResults, scaleRatio, scaleMinVw, scaleMaxVw]);

  const handlePreviewVw = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPreviewVw(parseInt(e.target.value));
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden" style={{ background: "#0a0a0a" }}>
      {/* Header */}
      <header className="border-b border-neutral-800 px-4 sm:px-6 py-4 sm:py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <a
                href="/"
                className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-500 hover:text-[#B8963E] transition-colors"
              >
                Web Typography
              </a>
              <h1
                className="text-xl sm:text-2xl font-bold tracking-tight mt-1"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                CSS clamp() Generator
              </h1>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setScaleMode(true)}
                className={`flex-1 sm:flex-none px-4 py-2 text-xs font-mono uppercase tracking-widest border transition-colors ${
                  scaleMode
                    ? "border-[#B8963E] text-[#B8963E] bg-[#B8963E]/10"
                    : "border-neutral-700 text-neutral-500 hover:border-neutral-500"
                }`}
              >
                Type Scale
              </button>
              <button
                onClick={() => setScaleMode(false)}
                className={`flex-1 sm:flex-none px-4 py-2 text-xs font-mono uppercase tracking-widest border transition-colors ${
                  !scaleMode
                    ? "border-[#B8963E] text-[#B8963E] bg-[#B8963E]/10"
                    : "border-neutral-700 text-neutral-500 hover:border-neutral-500"
                }`}
              >
                Single
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {!scaleMode ? (
          /* ── Single Calculator ── */
          <div className="space-y-8 sm:space-y-10">
            {/* Inputs */}
            <section className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-8">
              <h2
                className="text-xl font-bold tracking-tight mb-6"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Input Values
              </h2>

              <div className="flex gap-4 mb-6 flex-wrap">
                <button
                  onClick={() => setUnit("px")}
                  className={`px-3 py-1 text-xs font-mono uppercase tracking-widest border transition-colors ${
                    unit === "px"
                      ? "border-[#B8963E] text-[#B8963E]"
                      : "border-neutral-700 text-neutral-500"
                  }`}
                >
                  px
                </button>
                <button
                  onClick={() => setUnit("rem")}
                  className={`px-3 py-1 text-xs font-mono uppercase tracking-widest border transition-colors ${
                    unit === "rem"
                      ? "border-[#B8963E] text-[#B8963E]"
                      : "border-neutral-700 text-neutral-500"
                  }`}
                >
                  rem
                </button>
                {unit === "rem" && (
                  <div className="w-full sm:w-32 sm:ml-auto">
                    <NumberInput label="Base (px)" value={basePx} onChange={setBasePx} min={1} max={32} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                <NumberInput
                  label={`Min Font (${unit})`}
                  value={minFs}
                  onChange={setMinFs}
                  min={0}
                  step={unit === "rem" ? 0.125 : 1}
                />
                <NumberInput
                  label={`Max Font (${unit})`}
                  value={maxFs}
                  onChange={setMaxFs}
                  min={0}
                  step={unit === "rem" ? 0.125 : 1}
                />
                <NumberInput
                  label="Min Vw (px)"
                  value={minVw}
                  onChange={setMinVw}
                  min={0}
                />
                <NumberInput
                  label="Max Vw (px)"
                  value={maxVw}
                  onChange={setMaxVw}
                  min={0}
                />
              </div>
            </section>

            {/* Output */}
            <section className="border border-neutral-800 bg-neutral-950/50">
              <div className="p-4 sm:p-8 border-b border-neutral-800">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                  <h2
                    className="text-xl font-bold tracking-tight"
                    style={{ fontFamily: "var(--font-playfair)" }}
                  >
                    Output
                  </h2>
                  <CopyBtn text={`font-size: ${single.clamp};`} />
                </div>
                <pre className="bg-neutral-950 border border-neutral-800 p-3 sm:p-4 overflow-x-auto text-xs sm:text-sm font-mono text-neutral-300 leading-relaxed">
                  <code className="break-all"><span className="text-neutral-500">font-size:</span> <span className="text-[#B8963E]">{single.clamp}</span>;</code>
                </pre>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4 text-xs font-mono text-neutral-500">
                  <div>
                    <span className="block text-[10px] uppercase tracking-[0.2em] text-neutral-600 mb-0.5">Slope</span>
                    {(single.slope * 100).toFixed(4)}vw
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-[0.2em] text-neutral-600 mb-0.5">Intercept</span>
                    {(single.intercept / basePx).toFixed(4)}rem
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-[0.2em] text-neutral-600 mb-0.5">Range</span>
                    {singleMinPx.toFixed(1)}--{singleMaxPx.toFixed(1)}px
                  </div>
                </div>
              </div>
            </section>

            {/* Live Preview */}
            <section className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-8">
              <h2
                className="text-xl font-bold tracking-tight mb-4"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Live Preview
              </h2>
              <div className="mb-4">
                <div className="flex justify-between items-baseline mb-1">
                  <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                    Simulated Viewport
                  </label>
                  <span className="font-mono text-[11px] text-neutral-400">{previewVw}px</span>
                </div>
                <input
                  type="range"
                  min={200}
                  max={2000}
                  step={1}
                  value={previewVw}
                  onChange={handlePreviewVw}
                  className="w-full accent-[#B8963E] h-1 touch-pan-x"
                />
                <div className="flex justify-between font-mono text-[10px] text-neutral-600 mt-1">
                  <span>200px</span>
                  <span>2000px</span>
                </div>
              </div>
              <div className="border border-neutral-800 p-4 sm:p-6 overflow-hidden">
                <p
                  className="text-neutral-200 transition-none leading-tight break-words"
                  style={{ fontSize: `${singlePreviewPx}px` }}
                >
                  The quick brown fox jumps over the lazy dog
                </p>
                <p className="font-mono text-[11px] text-neutral-600 mt-4">
                  Computed: {singlePreviewPx.toFixed(2)}px at {previewVw}px viewport
                </p>
              </div>
            </section>
          </div>
        ) : (
          /* ── Type Scale Generator ── */
          <div className="space-y-8 sm:space-y-10">
            {/* Scale Preview */}
            <section className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-8">
              <h2
                className="text-xl font-bold tracking-tight mb-4"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Scale Preview
              </h2>
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-1">
                  <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                    Simulated Viewport
                  </label>
                  <span className="font-mono text-[11px] text-neutral-400">{previewVw}px</span>
                </div>
                <input
                  type="range"
                  min={200}
                  max={2000}
                  step={1}
                  value={previewVw}
                  onChange={handlePreviewVw}
                  className="w-full accent-[#B8963E] h-1 touch-pan-x"
                />
                <div className="flex justify-between font-mono text-[10px] text-neutral-600 mt-1">
                  <span>200px</span>
                  <span>2000px</span>
                </div>
              </div>
              <div className="border border-neutral-800 p-4 sm:p-6 space-y-4 overflow-hidden">
                {[...scaleResults].reverse().map((s) => {
                  const px = pxAtViewport(s.minPx, s.slope, s.intercept, s.maxPx, previewVw);
                  const isHeading = s.label.startsWith("h");
                  return (
                    <div key={s.label} className="border-b border-neutral-800/50 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 w-12 shrink-0">
                          {s.label}
                        </span>
                        <span className="font-mono text-[10px] text-neutral-700">
                          {px.toFixed(1)}px
                        </span>
                      </div>
                      <p
                        className="text-neutral-200 leading-snug break-words"
                        style={{
                          fontSize: `${px}px`,
                          fontWeight: isHeading ? 700 : 400,
                          fontFamily: isHeading ? "var(--font-playfair)" : "var(--font-source-sans)",
                        }}
                      >
                        {PREVIEW_TEXT[s.label]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Scale Inputs */}
            <section className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-8">
              <h2
                className="text-xl font-bold tracking-tight mb-6"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Scale Configuration
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-1">
                    Ratio
                  </label>
                  <select
                    value={scaleRatio}
                    onChange={(e) => setScaleRatio(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm font-mono text-neutral-200 outline-none focus:border-[#B8963E] transition-colors appearance-none"
                  >
                    {Object.keys(RATIOS).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <NumberInput
                  label="Base Size (px)"
                  value={scaleBase}
                  onChange={setScaleBase}
                  min={8}
                  max={32}
                />
                <NumberInput
                  label="Min Viewport (px)"
                  value={scaleMinVw}
                  onChange={setScaleMinVw}
                  min={200}
                />
                <NumberInput
                  label="Max Viewport (px)"
                  value={scaleMaxVw}
                  onChange={setScaleMaxVw}
                  min={200}
                />
                <div className="sm:col-span-2">
                  <div className="flex justify-between items-baseline mb-1">
                    <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                      Min Scale Factor
                    </label>
                    <span className="font-mono text-[11px] text-neutral-400">{scaleShrink}</span>
                  </div>
                  <input
                    type="range"
                    min={0.3}
                    max={1}
                    step={0.05}
                    value={scaleShrink}
                    onChange={(e) => setScaleShrink(parseFloat(e.target.value))}
                    className="w-full accent-[#B8963E] h-1 touch-pan-x"
                  />
                  <p className="font-mono text-[10px] text-neutral-600 mt-1">
                    Controls how much sizes compress at the minimum viewport. Lower = more compression for larger headings.
                  </p>
                </div>
              </div>
            </section>

            {/* Scale Output */}
            <section className="border border-neutral-800 bg-neutral-950/50">
              <div className="p-4 sm:p-8 border-b border-neutral-800">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                  <h2
                    className="text-xl font-bold tracking-tight"
                    style={{ fontFamily: "var(--font-playfair)" }}
                  >
                    Generated CSS
                  </h2>
                  <CopyBtn text={scaleCSS} />
                </div>
                <pre className="bg-neutral-950 border border-neutral-800 p-3 sm:p-4 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed">
                  {scaleResults.map((s) => (
                    <div key={s.label}>
                      <span className="text-neutral-600">/* {s.label}: {s.minPx.toFixed(1)}px -- {s.maxPx.toFixed(1)}px */</span>
                      {"\n"}
                      <span className="text-neutral-500">--fs-{s.label}:</span>{" "}
                      <span className="text-[#B8963E] break-all">{s.clamp}</span>;
                      {"\n\n"}
                    </div>
                  ))}
                </pre>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-800 py-12 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">
          Built with care for the craft of typography
        </p>
      </footer>
    </main>
  );
}
