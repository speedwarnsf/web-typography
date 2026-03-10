"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import FontSelect from "@/components/FontSelect";
import type { FontOption } from "@/components/FontSelect";
import CodeBlock from "@/components/CodeBlock";

// ── Font Database ──
type AxisDef = {
  tag: string;
  name: string;
  min: number;
  max: number;
  default: number;
};

type VarFont = {
  name: string;
  family: string;
  axes: AxisDef[];
  googleUrl: string;
};

const FONTS: VarFont[] = [
  {
    name: "Inter",
    family: "Inter",
    axes: [
      { tag: "wght", name: "Weight", min: 100, max: 900, default: 400 },
      { tag: "slnt", name: "Slant", min: -10, max: 0, default: 0 },
    ],
    googleUrl: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  {
    name: "Recursive",
    family: "Recursive",
    axes: [
      { tag: "wght", name: "Weight", min: 300, max: 1000, default: 400 },
      { tag: "slnt", name: "Slant", min: -15, max: 0, default: 0 },
      { tag: "CASL", name: "Casual", min: 0, max: 1, default: 0 },
      { tag: "CRSV", name: "Cursive", min: 0, max: 1, default: 0.5 },
      { tag: "MONO", name: "Monospace", min: 0, max: 1, default: 0 },
    ],
    googleUrl: "https://fonts.googleapis.com/css2?family=Recursive:slnt,wght,CASL,CRSV,MONO@-15..0,300..1000,0..1,0..1,0..1&display=swap",
  },
  {
    name: "Roboto Flex",
    family: "Roboto Flex",
    axes: [
      { tag: "wght", name: "Weight", min: 100, max: 1000, default: 400 },
      { tag: "wdth", name: "Width", min: 25, max: 151, default: 100 },
      { tag: "opsz", name: "Optical Size", min: 8, max: 144, default: 14 },
      { tag: "GRAD", name: "Grade", min: -200, max: 150, default: 0 },
      { tag: "slnt", name: "Slant", min: -10, max: 0, default: 0 },
      { tag: "XTRA", name: "Counter Width", min: 323, max: 603, default: 468 },
      { tag: "YOPQ", name: "Thin Stroke", min: 25, max: 135, default: 79 },
      { tag: "YTAS", name: "Ascender Height", min: 649, max: 854, default: 750 },
      { tag: "YTDE", name: "Descender Depth", min: -305, max: -98, default: -203 },
      { tag: "YTFI", name: "Figure Height", min: 560, max: 788, default: 738 },
      { tag: "YTLC", name: "Lowercase Height", min: 416, max: 570, default: 514 },
      { tag: "YTUC", name: "Uppercase Height", min: 528, max: 760, default: 712 },
    ],
    googleUrl: "https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,slnt,wdth,wght,GRAD,XTRA,YOPQ,YTAS,YTDE,YTFI,YTLC,YTUC@8..144,-10..0,25..151,100..1000,-200..150,323..603,25..135,649..854,-305..-98,560..788,416..570,528..760&display=swap",
  },
  {
    name: "Source Sans 3",
    family: "Source Sans 3",
    axes: [
      { tag: "wght", name: "Weight", min: 200, max: 900, default: 400 },
      { tag: "ital", name: "Italic", min: 0, max: 1, default: 0 },
    ],
    googleUrl: "https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap",
  },
  {
    name: "Outfit",
    family: "Outfit",
    axes: [
      { tag: "wght", name: "Weight", min: 100, max: 900, default: 400 },
    ],
    googleUrl: "https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap",
  },
  {
    name: "Commissioner",
    family: "Commissioner",
    axes: [
      { tag: "wght", name: "Weight", min: 100, max: 900, default: 400 },
      { tag: "slnt", name: "Slant", min: -12, max: 0, default: 0 },
      { tag: "FLAR", name: "Flare", min: 0, max: 100, default: 0 },
      { tag: "VOLM", name: "Volume", min: 0, max: 100, default: 0 },
    ],
    googleUrl: "https://fonts.googleapis.com/css2?family=Commissioner:slnt,wght,FLAR,VOLM@-12..0,100..900,0..100,0..100&display=swap",
  },
  {
    name: "Fraunces",
    family: "Fraunces",
    axes: [
      { tag: "wght", name: "Weight", min: 100, max: 900, default: 400 },
      { tag: "opsz", name: "Optical Size", min: 9, max: 144, default: 14 },
      { tag: "SOFT", name: "Softness", min: 0, max: 100, default: 0 },
      { tag: "WONK", name: "Wonky", min: 0, max: 1, default: 0 },
    ],
    googleUrl: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,100..900,0..100,0..1;1,9..144,100..900,0..100,0..1&display=swap",
  },
  {
    name: "Crimson Pro",
    family: "Crimson Pro",
    axes: [
      { tag: "wght", name: "Weight", min: 200, max: 900, default: 400 },
    ],
    googleUrl: "https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@200..900&display=swap",
  },
  {
    name: "Literata",
    family: "Literata",
    axes: [
      { tag: "wght", name: "Weight", min: 200, max: 900, default: 400 },
      { tag: "opsz", name: "Optical Size", min: 7, max: 72, default: 14 },
    ],
    googleUrl: "https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,200..900&display=swap",
  },
  {
    name: "Newsreader",
    family: "Newsreader",
    axes: [
      { tag: "wght", name: "Weight", min: 200, max: 800, default: 400 },
      { tag: "opsz", name: "Optical Size", min: 6, max: 72, default: 14 },
    ],
    googleUrl: "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,200..800&display=swap",
  },
  {
    name: "Bricolage Grotesque",
    family: "Bricolage Grotesque",
    axes: [
      { tag: "wght", name: "Weight", min: 200, max: 800, default: 400 },
      { tag: "wdth", name: "Width", min: 75, max: 100, default: 100 },
      { tag: "opsz", name: "Optical Size", min: 12, max: 96, default: 14 },
    ],
    googleUrl: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&display=swap",
  },
  {
    name: "Playfair Display",
    family: "Playfair Display",
    axes: [
      { tag: "wght", name: "Weight", min: 400, max: 900, default: 400 },
    ],
    googleUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400..900&display=swap",
  },
  {
    name: "Sora",
    family: "Sora",
    axes: [
      { tag: "wght", name: "Weight", min: 100, max: 800, default: 400 },
    ],
    googleUrl: "https://fonts.googleapis.com/css2?family=Sora:wght@100..800&display=swap",
  },
];

const SPECIMEN_CHARS = `ABCDEFGHIJKLMNOPQRSTUVWXYZ
abcdefghijklmnopqrstuvwxyz
0123456789
!@#$%^&*()_+-=[]{}|;':",./<>?`;

const DEFAULT_TEXT = "The quick brown fox jumps over the lazy dog. Typography is the art and technique of arranging type to make written language legible, readable, and appealing when displayed.";

type PreviewMode = "paragraph" | "heading" | "specimen";

function buildFontVariationSettings(axes: Record<string, number>): string {
  return Object.entries(axes)
    .map(([tag, value]) => `"${tag}" ${value}`)
    .join(", ");
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="px-3 py-1 text-xs font-mono tracking-wider uppercase border border-[#B8963E] text-[#B8963E] hover:bg-[#B8963E] hover:text-black transition-colors duration-200 shrink-0"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function AxisSlider({
  axis,
  value,
  onChange,
}: {
  axis: AxisDef;
  value: number;
  onChange: (v: number) => void;
}) {
  const isCustom = axis.tag === axis.tag.toUpperCase() && axis.tag.length === 4;
  const step = axis.max - axis.min <= 2 ? 0.01 : 1;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`font-mono text-xs px-1.5 py-0.5 border shrink-0 ${
              isCustom
                ? "border-[#B8963E]/40 text-[#B8963E]"
                : "border-neutral-700 text-neutral-400"
            }`}
          >
            {axis.tag}
          </span>
          <span className="text-sm text-neutral-300 truncate">{axis.name}</span>
        </div>
        <input
          type="number"
          value={Number(value.toFixed(2))}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(Math.min(axis.max, Math.max(axis.min, v)));
          }}
          className="w-16 sm:w-20 bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs font-mono px-2 py-1 text-right focus:border-[#B8963E] focus:outline-none shrink-0"
          step={step}
          min={axis.min}
          max={axis.max}
        />
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-[10px] font-mono text-neutral-600 w-8 sm:w-12 text-right shrink-0">
          {axis.min}
        </span>
        <input
          type="range"
          min={axis.min}
          max={axis.max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 h-1 appearance-none bg-neutral-800 cursor-pointer accent-[#B8963E] touch-pan-x [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 sm:[&::-webkit-slider-thumb]:w-3 sm:[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#B8963E] [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-neutral-800"
        />
        <span className="text-[10px] font-mono text-neutral-600 w-8 sm:w-12 shrink-0">
          {axis.max}
        </span>
      </div>
    </div>
  );
}

function FontPanel({
  id,
  fonts,
  customFonts,
  initialFontIndex,
}: {
  id: string;
  fonts: VarFont[];
  customFonts: VarFont[];
  initialFontIndex?: number;
}) {
  const allFonts = [...fonts, ...customFonts];
  const [fontIndex, setFontIndex] = useState(initialFontIndex ?? 0);
  const font = allFonts[fontIndex] || allFonts[0];
  const [axisValues, setAxisValues] = useState<Record<string, number>>(() => {
    const vals: Record<string, number> = {};
    font.axes.forEach((a) => (vals[a.tag] = a.default));
    return vals;
  });
  const [previewText, setPreviewText] = useState(DEFAULT_TEXT);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("paragraph");
  const [fontSize, setFontSize] = useState(32);
  const [isAnimating, setIsAnimating] = useState(false);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const vals: Record<string, number> = {};
    font.axes.forEach((a) => (vals[a.tag] = a.default));
    setAxisValues(vals);
    setIsAnimating(false);
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, [font]);

  useEffect(() => {
    if (!isAnimating) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    let startTime: number | null = null;
    const duration = 3000;

    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const t = (elapsed % (duration * 2)) / duration;
      const progress = t <= 1 ? t : 2 - t;

      const newVals: Record<string, number> = {};
      font.axes.forEach((a) => {
        newVals[a.tag] = a.min + (a.max - a.min) * progress;
      });
      setAxisValues(newVals);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isAnimating, font]);

  const fvs = buildFontVariationSettings(axisValues);

  const googleUrlOutput = font.googleUrl.startsWith("blob:") ? "/* Custom uploaded font */" : font.googleUrl;

  const fullCss = `/* Google Fonts */
@import url('${googleUrlOutput}');

.my-text {
  font-family: '${font.family}', sans-serif;
  font-variation-settings: ${fvs};
  font-size: ${fontSize}px;
}`;

  const previewStyle: React.CSSProperties = {
    fontFamily: `'${font.family}', sans-serif`,
    fontVariationSettings: fvs,
    fontSize: `${fontSize}px`,
    lineHeight: previewMode === "heading" ? 1.1 : 1.6,
  };

  const resetAxes = () => {
    const vals: Record<string, number> = {};
    font.axes.forEach((a) => (vals[a.tag] = a.default));
    setAxisValues(vals);
  };

  return (
    <div className="border border-neutral-800 bg-neutral-950/50 overflow-hidden">
      {!font.googleUrl.startsWith("blob:") && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={font.googleUrl} />
      )}

      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-neutral-800">
        <div className="flex flex-col gap-3">
          <FontSelect
            options={allFonts.map((f, i) => ({
              label: `${f.name} (${f.axes.length} ${f.axes.length === 1 ? "axis" : "axes"})`,
              value: i,
              fontFamily: `'${f.family}', sans-serif`,
            }))}
            value={fontIndex}
            onChange={(v) => setFontIndex(Number(v))}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAnimating(!isAnimating)}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-mono tracking-wider uppercase border transition-colors duration-200 ${
                isAnimating
                  ? "border-[#B8963E] bg-[#B8963E] text-black"
                  : "border-neutral-700 text-neutral-400 hover:border-[#B8963E] hover:text-[#B8963E]"
              }`}
            >
              {isAnimating ? "Stop" : "Animate"}
            </button>
            <button
              onClick={resetAxes}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-mono tracking-wider uppercase border border-neutral-700 text-neutral-400 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors duration-200"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Axis Controls */}
        <div className="w-full lg:w-[360px] shrink-0 border-b lg:border-b-0 lg:border-r border-neutral-800 p-4 sm:p-6 overflow-y-auto max-h-[400px] lg:max-h-[600px]">
          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 mb-4">
            Variation Axes
          </p>
          {font.axes.map((axis) => (
            <AxisSlider
              key={`${id}-${font.name}-${axis.tag}`}
              axis={axis}
              value={axisValues[axis.tag] ?? axis.default}
              onChange={(v) =>
                setAxisValues((prev) => ({ ...prev, [axis.tag]: v }))
              }
            />
          ))}

          {/* Font size */}
          <div className="mt-6 pt-4 border-t border-neutral-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-neutral-300">Font Size</span>
              <span className="font-mono text-xs text-neutral-500">{fontSize}px</span>
            </div>
            <input
              type="range"
              min={8}
              max={200}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full h-1 appearance-none bg-neutral-800 cursor-pointer accent-[#B8963E] touch-pan-x [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 sm:[&::-webkit-slider-thumb]:w-3 sm:[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#B8963E] [&::-webkit-slider-thumb]:border-0"
            />
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 p-4 sm:p-6 min-w-0">
          {/* Mode tabs */}
          <div className="flex items-center gap-0 mb-6 border border-neutral-800 w-full overflow-hidden">
            {(["paragraph", "heading", "specimen"] as PreviewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setPreviewMode(mode)}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors ${
                  previewMode === mode
                    ? "bg-[#B8963E] text-black"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="min-h-[150px] sm:min-h-[200px] mb-6 overflow-hidden">
            {previewMode === "specimen" ? (
              <pre style={previewStyle} className="whitespace-pre-wrap break-all overflow-hidden">
                {SPECIMEN_CHARS}
              </pre>
            ) : (
              <div
                contentEditable
                suppressContentEditableWarning
                style={previewStyle}
                className="outline-none focus:outline-none min-h-[150px] sm:min-h-[200px] text-neutral-100 break-words overflow-wrap-anywhere"
                onBlur={(e) => setPreviewText(e.currentTarget.textContent || "")}
              >
                {previewMode === "heading"
                  ? previewText.split(".")[0] || previewText
                  : previewText}
              </div>
            )}
          </div>

          {/* CSS Output */}
          <CodeBlock code={fullCss} title="CSS Output" />
        </div>
      </div>
    </div>
  );
}

// ── Custom Font Upload Parser ──
function parseOpenTypeAxes(buffer: ArrayBuffer): AxisDef[] {
  const view = new DataView(buffer);
  const numTables = view.getUint16(4);
  let fvarOffset = 0;

  for (let i = 0; i < numTables; i++) {
    const offset = 12 + i * 16;
    const tag = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    if (tag === "fvar") {
      fvarOffset = view.getUint32(offset + 8);
      break;
    }
  }

  if (!fvarOffset) return [];

  const axisCount = view.getUint16(fvarOffset + 8);
  const axisSize = view.getUint16(fvarOffset + 10);
  const axes: AxisDef[] = [];

  for (let i = 0; i < axisCount; i++) {
    const axOff = fvarOffset + 16 + i * axisSize;
    const tag = String.fromCharCode(
      view.getUint8(axOff),
      view.getUint8(axOff + 1),
      view.getUint8(axOff + 2),
      view.getUint8(axOff + 3)
    );
    const min = view.getInt32(axOff + 4) / 65536;
    const def = view.getInt32(axOff + 8) / 65536;
    const max = view.getInt32(axOff + 12) / 65536;

    const knownNames: Record<string, string> = {
      wght: "Weight",
      wdth: "Width",
      slnt: "Slant",
      ital: "Italic",
      opsz: "Optical Size",
      GRAD: "Grade",
      CASL: "Casual",
      CRSV: "Cursive",
      MONO: "Monospace",
      SOFT: "Softness",
      WONK: "Wonky",
      FLAR: "Flare",
      VOLM: "Volume",
      XTRA: "Counter Width",
    };

    axes.push({
      tag,
      name: knownNames[tag] || tag,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      default: Math.round(def * 100) / 100,
    });
  }

  return axes;
}

export default function VariableFontsPage() {
  const [customFonts, setCustomFonts] = useState<VarFont[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFontUpload = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer();
    const axes = parseOpenTypeAxes(buffer);
    if (axes.length === 0) {
      alert("No variable axes found. This may not be a variable font.");
      return;
    }

    const fontName = file.name.replace(/\.(ttf|woff2|woff|otf)$/i, "");
    const blob = new Blob([buffer], { type: "font/ttf" });
    const url = URL.createObjectURL(blob);

    const face = new FontFace(fontName, `url(${url})`);
    await face.load();
    document.fonts.add(face);

    setCustomFonts((prev) => [
      ...prev,
      {
        name: `${fontName} (uploaded)`,
        family: fontName,
        axes,
        googleUrl: `blob:${url}`,
      },
    ]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && /\.(ttf|woff2|woff|otf)$/i.test(file.name)) {
        handleFontUpload(file);
      }
    },
    [handleFontUpload]
  );

  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* ── Hero ── */}
      <section className="flex flex-col items-center justify-center min-h-[50vh] px-4 sm:px-6 text-center border-b border-neutral-800">
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-[#B8963E] mb-8">
          Variable Font Playground
        </p>
        <h1
          className="text-3xl sm:text-7xl md:text-8xl font-bold tracking-tight leading-[0.9] mb-8"
          style={{ fontFamily: "var(--font-playfair)", textWrap: "balance" }}
        >
          Explore Every Axis
        </h1>
        <p
          className="max-w-xl text-base sm:text-lg text-neutral-400 leading-relaxed"
          style={{ fontFamily: "var(--font-source-sans)", textWrap: "balance" }}
        >
          Manipulate variation axes in real time. Animate between extremes.
          Compare configurations. Generate production-ready CSS.
        </p>
        <div className="mt-12 flex flex-wrap justify-center gap-3 text-xs font-mono uppercase tracking-widest text-neutral-600">
          <a href="/" className="border border-neutral-800 px-4 py-2 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors">Home</a>
          <a href="/pairing-cards" className="border border-neutral-800 px-4 py-2 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors">Builder</a>
          <a href="/clamp" className="border border-neutral-800 px-4 py-2 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors">Clamp</a>
          <a href="/font-inspector" className="border border-neutral-800 px-4 py-2 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors">Inspector</a>
        </div>
      </section>

      {/* ── Main Playground ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="flex flex-col gap-4 mb-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-2">
              01 -- Playground
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Live Editor
            </h2>
          </div>
          <button
            onClick={() => setShowComparison(!showComparison)}
            className={`px-4 py-2 text-xs font-mono tracking-wider uppercase border transition-colors duration-200 w-full sm:w-auto ${
              showComparison
                ? "border-[#B8963E] bg-[#B8963E] text-black"
                : "border-neutral-700 text-neutral-400 hover:border-[#B8963E] hover:text-[#B8963E]"
            }`}
          >
            {showComparison ? "Hide Comparison" : "Compare Side-by-Side"}
          </button>
        </div>

        {/* Comparison: always stack on mobile, side-by-side on lg only */}
        <div className={`grid gap-6 sm:gap-8 ${showComparison ? "grid-cols-1 lg:grid-cols-2" : ""}`}>
          <FontPanel id="a" fonts={FONTS} customFonts={customFonts} initialFontIndex={0} />
          {showComparison && (
            <FontPanel id="b" fonts={FONTS} customFonts={customFonts} initialFontIndex={1} />
          )}
        </div>
      </section>

      {/* ── Upload ── */}
      <section className="border-t border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-2">
            02 -- Custom Font
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-8"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Upload Your Own
          </h2>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed p-4 sm:p-6 lg:p-8 sm:p-12 text-center cursor-pointer transition-colors duration-200 ${
              isDragOver
                ? "border-[#B8963E] bg-[#B8963E]/5"
                : "border-neutral-700 hover:border-neutral-500"
            }`}
          >
            <p className="text-neutral-400 text-xs sm:text-sm font-mono">
              Drop a variable font file here (.ttf, .woff2, .otf)
            </p>
            <p className="text-neutral-600 text-[10px] sm:text-xs font-mono mt-2">
              or click to browse
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ttf,.woff2,.woff,.otf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFontUpload(file);
              }}
            />
          </div>

          {customFonts.length > 0 && (
            <div className="mt-4">
              <p className="font-mono text-xs text-neutral-500 mb-2">
                Uploaded fonts ({customFonts.length}):
              </p>
              <div className="flex flex-wrap gap-2">
                {customFonts.map((f, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 text-xs font-mono border border-neutral-700 text-neutral-400"
                  >
                    {f.name} -- {f.axes.length} axes
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Font Index ── */}
      <section className="border-t border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-2">
            03 -- Font Index
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-8"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Available Fonts
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FONTS.map((font) => (
              <div
                key={font.name}
                className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-5"
              >
                {/* eslint-disable-next-line @next/next/no-page-custom-font */}
                <link rel="stylesheet" href={font.googleUrl} />
                <p
                  className="text-xl sm:text-2xl mb-2 text-neutral-100"
                  style={{ fontFamily: `'${font.family}', sans-serif` }}
                >
                  {font.name}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {font.axes.map((a) => {
                    const isCustom =
                      a.tag === a.tag.toUpperCase() && a.tag.length === 4;
                    return (
                      <span
                        key={a.tag}
                        className={`font-mono text-[10px] px-1.5 py-0.5 border ${
                          isCustom
                            ? "border-[#B8963E]/40 text-[#B8963E]/70"
                            : "border-neutral-700 text-neutral-500"
                        }`}
                      >
                        {a.tag}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
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
