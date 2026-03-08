"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import opentype, { Font } from "opentype.js";
import CodeBlock from "@/components/CodeBlock";

/* ── Types ── */
type FontMeta = {
  familyName: string;
  designer: string;
  version: string;
  glyphCount: number;
  unitsPerEm: number;
  isVariable: boolean;
};

type OTFeature = {
  tag: string;
  label: string;
  enabled: boolean;
};

type VarAxis = {
  tag: string;
  name: string;
  min: number;
  max: number;
  default: number;
  value: number;
};

/* ── OT Feature labels ── */
const FEATURE_LABELS: Record<string, string> = {
  liga: "Standard Ligatures",
  dlig: "Discretionary Ligatures",
  hlig: "Historical Ligatures",
  clig: "Contextual Ligatures",
  calt: "Contextual Alternates",
  salt: "Stylistic Alternates",
  smcp: "Small Capitals",
  c2sc: "Caps to Small Caps",
  swsh: "Swash",
  onum: "Oldstyle Numerals",
  lnum: "Lining Numerals",
  tnum: "Tabular Numerals",
  pnum: "Proportional Numerals",
  frac: "Fractions",
  ordn: "Ordinals",
  sups: "Superscript",
  subs: "Subscript",
  zero: "Slashed Zero",
  case: "Case-Sensitive Forms",
  kern: "Kerning",
  cpsp: "Capital Spacing",
  titl: "Titling",
  mark: "Mark Positioning",
  mkmk: "Mark to Mark",
  locl: "Localized Forms",
  rlig: "Required Ligatures",
  aalt: "Access All Alternates",
  hist: "Historical Forms",
  ornm: "Ornaments",
};

for (let i = 1; i <= 20; i++) {
  FEATURE_LABELS[`ss${String(i).padStart(2, "0")}`] = `Stylistic Set ${i}`;
  if (i <= 9) FEATURE_LABELS[`cv${String(i).padStart(2, "0")}`] = `Character Variant ${i}`;
}

/* ── Unicode range detection ── */
const UNICODE_RANGES: [string, number, number][] = [
  ["Basic Latin", 0x0020, 0x007f],
  ["Latin-1 Supplement", 0x0080, 0x00ff],
  ["Latin Extended-A", 0x0100, 0x017f],
  ["Latin Extended-B", 0x0180, 0x024f],
  ["Greek", 0x0370, 0x03ff],
  ["Cyrillic", 0x0400, 0x04ff],
  ["Arabic", 0x0600, 0x06ff],
  ["Devanagari", 0x0900, 0x097f],
  ["Thai", 0x0e00, 0x0e7f],
  ["Georgian", 0x10a0, 0x10ff],
  ["CJK Unified", 0x4e00, 0x9fff],
  ["Hangul", 0xac00, 0xd7af],
  ["General Punctuation", 0x2000, 0x206f],
  ["Currency Symbols", 0x20a0, 0x20cf],
  ["Math Operators", 0x2200, 0x22ff],
  ["Arrows", 0x2190, 0x21ff],
  ["Box Drawing", 0x2500, 0x257f],
  ["Dingbats", 0x2700, 0x27bf],
];

function detectUnicodeRanges(font: Font): string[] {
  const glyphs = font.glyphs;
  const codePoints = new Set<number>();
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs.get(i);
    if (g.unicode !== undefined && g.unicode !== null) codePoints.add(g.unicode);
    if (g.unicodes) g.unicodes.forEach((u: number) => codePoints.add(u));
  }
  const found: string[] = [];
  for (const [name, start, end] of UNICODE_RANGES) {
    for (const cp of codePoints) {
      if (cp >= start && cp <= end) {
        found.push(name);
        break;
      }
    }
  }
  return found;
}

function extractFeatures(font: Font): OTFeature[] {
  const tags = new Set<string>();
  const tables = ["gsub", "gpos"] as const;
  for (const tableName of tables) {
    const table = (font.tables as Record<string, unknown>)[tableName] as
      | { features?: { tag: string }[] }
      | undefined;
    if (table?.features) {
      for (const f of table.features) {
        tags.add(f.tag);
      }
    }
  }
  return Array.from(tags)
    .sort()
    .map((tag) => ({
      tag,
      label: FEATURE_LABELS[tag] || tag,
      enabled: false,
    }));
}

function extractAxes(font: Font): VarAxis[] {
  const fvar = (font.tables as Record<string, unknown>).fvar as
    | { axes?: { tag: string; name?: { en?: string }; minValue: number; maxValue: number; defaultValue: number }[] }
    | undefined;
  if (!fvar?.axes) return [];
  return fvar.axes.map((a) => ({
    tag: a.tag,
    name: a.name?.en || a.tag,
    min: a.minValue,
    max: a.maxValue,
    default: a.defaultValue,
    value: a.defaultValue,
  }));
}

/* ── Component ── */
export default function FontInspector() {
  const [fontData, setFontData] = useState<{
    meta: FontMeta;
    features: OTFeature[];
    axes: VarAxis[];
    unicodeRanges: string[];
    fontUrl: string;
    fileName: string;
  } | null>(null);
  const [features, setFeatures] = useState<OTFeature[]>([]);
  const [axes, setAxes] = useState<VarAxis[]>([]);
  const [previewText, setPreviewText] = useState(
    "The quick brown fox jumps over the lazy dog. 0123456789 fi fl ff ffi ffl"
  );
  const [previewSize, setPreviewSize] = useState(48);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontUrlRef = useRef<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const font = opentype.parse(buffer);

      if (fontUrlRef.current) URL.revokeObjectURL(fontUrlRef.current);
      const blob = new Blob([buffer], { type: "font/opentype" });
      const url = URL.createObjectURL(blob);
      fontUrlRef.current = url;

      const fontFace = new FontFace("InspectedFont", `url(${url})`);
      await fontFace.load();
      document.fonts.add(fontFace);

      const names = font.names;
      const meta: FontMeta = {
        familyName:
          names.fontFamily?.en ||
          names.preferredFamily?.en ||
          file.name.replace(/\.[^.]+$/, ""),
        designer: names.designer?.en || "Unknown",
        version: names.version?.en || "Unknown",
        glyphCount: font.glyphs.length,
        unitsPerEm: font.unitsPerEm,
        isVariable: false,
      };

      const extractedFeatures = extractFeatures(font);
      const extractedAxes = extractAxes(font);
      meta.isVariable = extractedAxes.length > 0;
      const unicodeRanges = detectUnicodeRanges(font);

      setFontData({
        meta,
        features: extractedFeatures,
        axes: extractedAxes,
        unicodeRanges,
        fontUrl: url,
        fileName: file.name,
      });
      setFeatures(extractedFeatures);
      setAxes(extractedAxes);
    } catch (e) {
      setError(`Failed to parse font: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const toggleFeature = (tag: string) => {
    setFeatures((prev) =>
      prev.map((f) => (f.tag === tag ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const updateAxis = (tag: string, value: number) => {
    setAxes((prev) =>
      prev.map((a) => (a.tag === tag ? { ...a, value } : a))
    );
  };

  const featureSettingsCSS = useMemo(() => {
    const enabled = features.filter((f) => f.enabled);
    if (enabled.length === 0) return "";
    return enabled.map((f) => `"${f.tag}" 1`).join(", ");
  }, [features]);

  const variationSettingsCSS = useMemo(() => {
    if (axes.length === 0) return "";
    return axes.map((a) => `"${a.tag}" ${a.value}`).join(", ");
  }, [axes]);

  const fontFaceCSS = useMemo(() => {
    if (!fontData) return "";
    const lines = [
      `@font-face {`,
      `  font-family: '${fontData.meta.familyName}';`,
      `  src: url('./${fontData.fileName}') format('${fontData.fileName.endsWith(".woff2") ? "woff2" : fontData.fileName.endsWith(".woff") ? "woff" : fontData.fileName.endsWith(".otf") ? "opentype" : "truetype"}');`,
      `  font-display: swap;`,
    ];
    if (fontData.meta.isVariable && axes.length > 0) {
      const weightAxis = axes.find((a) => a.tag === "wght");
      if (weightAxis) lines.push(`  font-weight: ${weightAxis.min} ${weightAxis.max};`);
      const widthAxis = axes.find((a) => a.tag === "wdth");
      if (widthAxis) lines.push(`  font-stretch: ${widthAxis.min}% ${widthAxis.max}%;`);
    }
    lines.push(`}`);
    return lines.join("\n");
  }, [fontData, axes]);

  const usageCSS = useMemo(() => {
    if (!fontData) return "";
    const lines = [`.my-text {`, `  font-family: '${fontData.meta.familyName}', sans-serif;`];
    if (featureSettingsCSS) lines.push(`  font-feature-settings: ${featureSettingsCSS};`);
    if (variationSettingsCSS) lines.push(`  font-variation-settings: ${variationSettingsCSS};`);
    lines.push(`}`);
    return lines.join("\n");
  }, [fontData, featureSettingsCSS, variationSettingsCSS]);

  const previewStyle: React.CSSProperties = useMemo(() => {
    const s: React.CSSProperties = {
      fontFamily: "InspectedFont, sans-serif",
      fontSize: `${previewSize}px`,
      lineHeight: 1.4,
    };
    if (featureSettingsCSS) s.fontFeatureSettings = featureSettingsCSS;
    if (variationSettingsCSS) s.fontVariationSettings = variationSettingsCSS;
    return s;
  }, [previewSize, featureSettingsCSS, variationSettingsCSS]);

  useEffect(() => {
    return () => {
      if (fontUrlRef.current) URL.revokeObjectURL(fontUrlRef.current);
    };
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* Header */}
      <section className="border-b border-neutral-800 px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <a
              href="/"
              className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-600 hover:text-[#B8963E] transition-colors"
            >
              Web Typography
            </a>
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mt-2"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Font Inspector
            </h1>
            <p
              className="text-neutral-400 mt-2 leading-relaxed text-sm sm:text-base"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              Drop a font file to inspect its features, axes, and generate CSS
            </p>
          </div>
          <a
            href="/"
            className="px-4 py-2 text-xs font-mono uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors w-full sm:w-auto text-center shrink-0"
          >
            Back
          </a>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed ${
            dragOver ? "border-[#B8963E] bg-[#B8963E]/5" : "border-neutral-700"
          } p-4 sm:p-6 lg:p-8 sm:p-12 text-center cursor-pointer transition-colors hover:border-neutral-500`}
        >
          <p className="font-mono text-xs sm:text-sm uppercase tracking-widest text-neutral-500 mb-2">
            Drop a font file here
          </p>
          <p className="text-[10px] sm:text-xs text-neutral-600">
            .ttf, .otf, .woff, .woff2 -- or click to browse
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            onChange={onFileChange}
            className="hidden"
          />
        </div>

        {error && (
          <div className="mt-4 border border-red-900/50 bg-red-950/20 p-4">
            <p className="text-sm text-red-400 font-mono break-all">{error}</p>
          </div>
        )}

        {fontData && (
          <div className="mt-8 sm:mt-12 space-y-8 sm:space-y-12">
            {/* ── Font Info ── */}
            <section>
              <h2
                className="text-2xl font-bold tracking-tight mb-4 sm:mb-6"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Font Information
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {[
                  ["Family", fontData.meta.familyName],
                  ["Designer", fontData.meta.designer],
                  ["Version", fontData.meta.version],
                  ["Glyphs", String(fontData.meta.glyphCount)],
                  ["Units/Em", String(fontData.meta.unitsPerEm)],
                  ["Type", fontData.meta.isVariable ? "Variable" : "Static"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="border border-neutral-800 bg-neutral-950/50 p-3 sm:p-4"
                  >
                    <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-600 mb-1">
                      {label}
                    </p>
                    <p className="text-xs sm:text-sm text-neutral-200 font-mono truncate">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Unicode Ranges ── */}
            {fontData.unicodeRanges.length > 0 && (
              <section>
                <h2
                  className="text-2xl font-bold tracking-tight mb-4 sm:mb-6"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  Unicode Coverage
                </h2>
                <div className="flex flex-wrap gap-2">
                  {fontData.unicodeRanges.map((range) => (
                    <span
                      key={range}
                      className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-mono border border-neutral-800 text-neutral-400 bg-neutral-950/50"
                    >
                      {range}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* ── Live Preview ── */}
            <section>
              <h2
                className="text-2xl font-bold tracking-tight mb-4 sm:mb-6"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Live Preview
              </h2>
              <div className="border border-neutral-800 bg-neutral-950/50">
                <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 border-b border-neutral-800">
                  <label className="text-xs font-mono uppercase tracking-widest text-neutral-600 shrink-0">
                    Size
                  </label>
                  <input
                    type="range"
                    min={12}
                    max={120}
                    value={previewSize}
                    onChange={(e) => setPreviewSize(Number(e.target.value))}
                    className="flex-1 accent-[#B8963E] touch-pan-x"
                  />
                  <span className="text-xs font-mono text-neutral-500 w-10 sm:w-12 text-right shrink-0">
                    {previewSize}px
                  </span>
                </div>
                <div className="p-4 sm:p-6">
                  <textarea
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                    style={previewStyle}
                    className="w-full bg-transparent text-neutral-200 resize-none outline-none min-h-[120px] break-words"
                    rows={3}
                  />
                </div>
              </div>
            </section>

            {/* ── OpenType Features ── */}
            {features.length > 0 && (
              <section>
                <h2
                  className="text-2xl font-bold tracking-tight mb-4 sm:mb-6"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  OpenType Features
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {features.map((f) => (
                    <label
                      key={f.tag}
                      className={`flex items-center gap-3 px-3 sm:px-4 py-3 border cursor-pointer transition-colors ${
                        f.enabled
                          ? "border-[#B8963E] bg-[#B8963E]/5"
                          : "border-neutral-800 bg-neutral-950/50 hover:border-neutral-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        onChange={() => toggleFeature(f.tag)}
                        className="accent-[#B8963E] shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-mono text-[#B8963E]">
                          {f.tag}
                        </span>
                        <span className="text-xs text-neutral-500 ml-2 truncate">
                          {f.label}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {/* ── Variable Axes ── */}
            {axes.length > 0 && (
              <section>
                <h2
                  className="text-2xl font-bold tracking-tight mb-4 sm:mb-6"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  Variation Axes
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  {axes.map((a) => (
                    <div
                      key={a.tag}
                      className="border border-neutral-800 bg-neutral-950/50 p-3 sm:p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="min-w-0">
                          <span className="text-xs font-mono text-[#B8963E]">
                            {a.tag}
                          </span>
                          <span className="text-xs text-neutral-500 ml-2">
                            {a.name}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-neutral-400 shrink-0">
                          {a.value}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-[10px] font-mono text-neutral-600 w-8 sm:w-10 shrink-0">
                          {a.min}
                        </span>
                        <input
                          type="range"
                          min={a.min}
                          max={a.max}
                          step={a.tag === "wght" ? 1 : (a.max - a.min) / 100}
                          value={a.value}
                          onChange={(e) => updateAxis(a.tag, Number(e.target.value))}
                          className="flex-1 accent-[#B8963E] touch-pan-x"
                        />
                        <span className="text-[10px] font-mono text-neutral-600 w-8 sm:w-10 text-right shrink-0">
                          {a.max}
                        </span>
                      </div>
                      <button
                        onClick={() => updateAxis(a.tag, a.default)}
                        className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 hover:text-[#B8963E] mt-1 transition-colors"
                      >
                        Reset to {a.default}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Generated CSS ── */}
            <section>
              <h2
                className="text-2xl font-bold tracking-tight mb-4 sm:mb-6"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Generated CSS
              </h2>
              <div className="space-y-4 sm:space-y-6">
                <CodeBlock code={fontFaceCSS} title="@font-face" />
                <CodeBlock code={usageCSS} title="Usage" />
                {featureSettingsCSS && (
                  <CodeBlock
                    code={`font-feature-settings: ${featureSettingsCSS};`}
                    title="font-feature-settings"
                  />
                )}
                {variationSettingsCSS && (
                  <CodeBlock
                    code={`font-variation-settings: ${variationSettingsCSS};`}
                    title="font-variation-settings"
                  />
                )}
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
