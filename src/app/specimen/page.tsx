"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import opentype, { Font } from "opentype.js";

/* ── Types ── */
type FontMeta = {
  familyName: string;
  designer: string;
  version: string;
  glyphCount: number;
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

/* ── Google Fonts List ── */
const GOOGLE_FONTS = [
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Oswald",
  "Source Sans Pro",
  "Raleway",
  "PT Sans",
  "Merriweather",
  "Poppins",
  "Ubuntu",
  "Playfair Display",
  "Nunito",
  "Mukta",
  "Rubik",
  "Work Sans",
  "Inter",
  "Noto Sans",
  "Fira Sans",
  "Quicksand",
  "Karla",
  "Barlow",
  "Inconsolata",
  "Source Code Pro",
  "IBM Plex Sans",
  "DM Sans",
  "Libre Baskerville",
  "Crimson Text",
  "Cormorant",
  "Space Grotesk",
];

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
};

for (let i = 1; i <= 20; i++) {
  FEATURE_LABELS[`ss${String(i).padStart(2, "0")}`] = `Stylistic Set ${i}`;
}

/* ── Helper Functions ── */
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
export default function TypeSpecimenGenerator() {
  const [fontData, setFontData] = useState<{
    meta: FontMeta;
    features: OTFeature[];
    axes: VarAxis[];
    fontUrl: string;
    fontFamily: string;
    isGoogleFont: boolean;
  } | null>(null);
  const [features, setFeatures] = useState<OTFeature[]>([]);
  const [axes, setAxes] = useState<VarAxis[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGoogleFonts, setShowGoogleFonts] = useState(false);
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

      const fontFace = new FontFace("SpecimenFont", `url(${url})`);
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
      };

      const extractedFeatures = extractFeatures(font);
      const extractedAxes = extractAxes(font);

      setFontData({
        meta,
        features: extractedFeatures,
        axes: extractedAxes,
        fontUrl: url,
        fontFamily: "SpecimenFont",
        isGoogleFont: false,
      });
      setFeatures(extractedFeatures);
      setAxes(extractedAxes);
    } catch (e) {
      setError(`Failed to parse font: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const handleGoogleFont = useCallback(async (fontName: string) => {
    setError(null);
    try {
      // Load Google Font with multiple weights
      const link = document.createElement("link");
      link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, "+")}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
      link.rel = "stylesheet";
      document.head.appendChild(link);

      // Wait for font to load
      await new Promise((resolve) => setTimeout(resolve, 500));

      setFontData({
        meta: {
          familyName: fontName,
          designer: "Google Fonts",
          version: "Latest",
          glyphCount: 0, // Unknown for Google Fonts
        },
        features: [],
        axes: [],
        fontUrl: "",
        fontFamily: fontName,
        isGoogleFont: true,
      });
      setFeatures([]);
      setAxes([]);
      setShowGoogleFonts(false);
    } catch (e) {
      setError(`Failed to load Google Font: ${e instanceof Error ? e.message : String(e)}`);
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

  const specimenStyle = useMemo(() => {
    const s: React.CSSProperties = {
      fontFamily: fontData?.fontFamily || "serif",
    };
    if (featureSettingsCSS) s.fontFeatureSettings = featureSettingsCSS;
    if (variationSettingsCSS) s.fontVariationSettings = variationSettingsCSS;
    return s;
  }, [fontData, featureSettingsCSS, variationSettingsCSS]);

  const exportHTML = useCallback(() => {
    if (!fontData) return;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fontData.meta.familyName} — Type Specimen</title>
  ${fontData.isGoogleFont ? `<link href="https://fonts.googleapis.com/css2?family=${fontData.fontFamily.replace(/ /g, "+")}:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet">` : ""}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 2rem; }
    .specimen-font { font-family: '${fontData.fontFamily}', serif; ${featureSettingsCSS ? `font-feature-settings: ${featureSettingsCSS};` : ""} ${variationSettingsCSS ? `font-variation-settings: ${variationSettingsCSS};` : ""} }
    .section { margin-bottom: 4rem; }
    .section-title { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.3em; color: #B8963E; margin-bottom: 1rem; }
    .waterfall-line { margin-bottom: 0.5rem; }
    .char-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 1rem; }
    .char-cell { text-align: center; padding: 1rem; border: 1px solid #262626; }
    .char-glyph { font-size: 2rem; margin-bottom: 0.5rem; }
    .char-unicode { font-size: 0.625rem; font-family: monospace; color: #737373; }
    @media print {
      body { background: white; color: black; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="section">
    <h1 class="specimen-font" style="font-size: 4rem; margin-bottom: 1rem;">${fontData.meta.familyName}</h1>
    <p style="color: #737373; margin-bottom: 0.5rem;">Designer: ${fontData.meta.designer}</p>
    <p style="color: #737373; margin-bottom: 0.5rem;">Version: ${fontData.meta.version}</p>
    ${fontData.meta.glyphCount > 0 ? `<p style="color: #737373;">Glyphs: ${fontData.meta.glyphCount}</p>` : ""}
  </div>

  <div class="section">
    <div class="section-title">Size Waterfall</div>
    ${[10, 12, 14, 16, 18, 21, 24, 28, 32, 36, 48, 60, 72, 96]
      .map(
        (size) =>
          `<div class="waterfall-line specimen-font" style="font-size: ${size}px;">The quick brown fox jumps over the lazy dog <span style="font-size: 0.625rem; color: #737373; font-family: monospace;">${size}px</span></div>`
      )
      .join("\n    ")}
  </div>

  <div class="section">
    <div class="section-title">Character Set</div>
    <div class="char-grid">
      ${"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:',.<>?/~`\""
        .split("")
        .map(
          (char) =>
            `<div class="char-cell"><div class="char-glyph specimen-font">${char}</div><div class="char-unicode">U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}</div></div>`
        )
        .join("\n      ")}
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fontData.meta.familyName.replace(/\s+/g, "-")}-specimen.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [fontData, featureSettingsCSS, variationSettingsCSS]);

  useEffect(() => {
    return () => {
      if (fontUrlRef.current) URL.revokeObjectURL(fontUrlRef.current);
    };
  }, []);

  const waterfallSizes = [10, 12, 14, 16, 18, 21, 24, 28, 32, 36, 48, 60, 72, 96];
  const weights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  const kerningPairs = ["AV", "AW", "AY", "FA", "LT", "LY", "PA", "TA", "TO", "VA", "WA", "Yo", "fi", "fl", "ff"];
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:',.<>?/~`\"";
  const sampleParagraph = "Typography is the art and technique of arranging type to make written language legible, readable, and appealing when displayed. The arrangement of type involves selecting typefaces, point sizes, line lengths, line-spacing, and letter-spacing, and adjusting the space between pairs of letters.";

  const bgClass = isDarkMode ? "bg-[#0a0a0a]/85" : "bg-white";
  const textClass = isDarkMode ? "text-neutral-200" : "text-neutral-900";
  const borderClass = isDarkMode ? "border-neutral-800" : "border-neutral-300";
  const cardBgClass = isDarkMode ? "bg-neutral-950/50" : "bg-neutral-50";

  return (
    <main className={`min-h-screen overflow-x-hidden ${bgClass} ${textClass} transition-colors`}>
      {/* Header */}
      <section className={`border-b ${borderClass} px-4 sm:px-6 py-6 sm:py-8`}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E]">
              07 -- Type Specimen Generator
            </p>
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mt-2"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Type Specimen Generator
            </h1>
            <p
              className={`${isDarkMode ? "text-neutral-400" : "text-neutral-600"} mt-2 leading-relaxed text-sm sm:text-base`}
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              Upload any font or pick one from Google Fonts to build a full specimen&nbsp;sheet
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border ${borderClass} ${isDarkMode ? "text-neutral-400" : "text-neutral-600"} hover:border-[#B8963E] hover:text-[#B8963E] transition-colors`}
              style={{ borderRadius: 0 }}
            >
              {isDarkMode ? "Light" : "Dark"}
            </button>
            <a
              href="/"
              className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border ${borderClass} ${isDarkMode ? "text-neutral-400" : "text-neutral-600"} hover:border-[#B8963E] hover:text-[#B8963E] transition-colors text-center`}
              style={{ borderRadius: 0 }}
            >
              Back
            </a>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Font Input */}
        <div className="mb-8 sm:mb-12 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed ${
              dragOver ? "border-[#B8963E] bg-[#B8963E]/5" : borderClass
            } p-4 sm:p-6 lg:p-8 sm:p-12 text-center cursor-pointer transition-colors ${isDarkMode ? "hover:border-neutral-500" : "hover:border-neutral-400"}`}
            style={{ borderRadius: 0 }}
          >
            <p className="font-mono text-xs sm:text-sm uppercase tracking-widest text-[#B8963E] mb-2">
              Drop a font file here
            </p>
            <p className={`text-[10px] sm:text-xs ${isDarkMode ? "text-neutral-600" : "text-neutral-500"}`}>
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

          <div className="text-center">
            <button
              onClick={() => setShowGoogleFonts(!showGoogleFonts)}
              className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border ${borderClass} ${isDarkMode ? "text-neutral-400" : "text-neutral-600"} hover:border-[#B8963E] hover:text-[#B8963E] transition-colors`}
              style={{ borderRadius: 0 }}
            >
              {showGoogleFonts ? "Hide" : "Select"} Google Fonts
            </button>
          </div>

          {showGoogleFonts && (
            <div className={`border ${borderClass} ${cardBgClass} p-4 sm:p-6`} style={{ borderRadius: 0 }}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {GOOGLE_FONTS.map((fontName) => (
                  <button
                    key={fontName}
                    onClick={() => handleGoogleFont(fontName)}
                    className={`px-3 py-2 text-xs border ${borderClass} ${isDarkMode ? "text-neutral-400 hover:border-[#B8963E]" : "text-neutral-600 hover:border-[#B8963E]"} transition-colors text-left`}
                    style={{ borderRadius: 0 }}
                  >
                    {fontName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className={`mb-8 border ${isDarkMode ? "border-red-900/50 bg-red-950/20" : "border-red-300 bg-red-50"} p-4`} style={{ borderRadius: 0 }}>
            <p className={`text-sm ${isDarkMode ? "text-red-400" : "text-red-700"} font-mono break-all`}>{error}</p>
          </div>
        )}

        {fontData && (
          <div className="space-y-8 sm:space-y-12">
            {/* ── Header Info ── */}
            <section>
              <div className={`border ${borderClass} ${cardBgClass} p-4 sm:p-6 sm:p-8`} style={{ borderRadius: 0 }}>
                <h2
                  className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4"
                  style={{ ...specimenStyle, fontFamily: fontData.fontFamily }}
                >
                  {fontData.meta.familyName}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-widest text-[#B8963E] mb-1">Designer</p>
                    <p className={isDarkMode ? "text-neutral-300" : "text-neutral-700"}>{fontData.meta.designer}</p>
                  </div>
                  <div>
                    <p className="font-mono text-xs uppercase tracking-widest text-[#B8963E] mb-1">Version</p>
                    <p className={isDarkMode ? "text-neutral-300" : "text-neutral-700"}>{fontData.meta.version}</p>
                  </div>
                  {fontData.meta.glyphCount > 0 && (
                    <div>
                      <p className="font-mono text-xs uppercase tracking-widest text-[#B8963E] mb-1">Glyphs</p>
                      <p className={isDarkMode ? "text-neutral-300" : "text-neutral-700"}>{fontData.meta.glyphCount}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ── Size Waterfall ── */}
            <section>
              <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">01 -- Size Waterfall</h3>
              <div className={`border ${borderClass} ${cardBgClass} p-4 sm:p-6 sm:p-8`} style={{ borderRadius: 0 }}>
                {waterfallSizes.map((size) => (
                  <div key={size} className="mb-2 flex items-baseline gap-4">
                    <span style={{ ...specimenStyle, fontSize: `${size}px`, lineHeight: 1.2 }}>
                      The quick brown fox jumps over the lazy dog
                    </span>
                    <span className={`font-mono text-xs ${isDarkMode ? "text-neutral-600" : "text-neutral-500"} shrink-0`}>
                      {size}px
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Weight Waterfall ── */}
            {fontData.isGoogleFont && (
              <section>
                <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">02 -- Weight Waterfall</h3>
                <div className={`border ${borderClass} ${cardBgClass} p-4 sm:p-6 sm:p-8`} style={{ borderRadius: 0 }}>
                  {weights.map((weight) => (
                    <div key={weight} className="mb-2 flex items-baseline gap-4">
                      <span style={{ ...specimenStyle, fontSize: "48px", fontWeight: weight, lineHeight: 1.2 }}>
                        Typography
                      </span>
                      <span className={`font-mono text-xs ${isDarkMode ? "text-neutral-600" : "text-neutral-500"} shrink-0`}>
                        {weight}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Character Set ── */}
            <section>
              <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">03 -- Character Set</h3>
              <div className={`border ${borderClass} ${cardBgClass} p-4 sm:p-6 sm:p-8`} style={{ borderRadius: 0 }}>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-4">
                  {characters.split("").map((char, idx) => (
                    <div key={idx} className={`text-center border ${borderClass} p-3`} style={{ borderRadius: 0 }}>
                      <div className="text-2xl sm:text-3xl mb-2" style={specimenStyle}>
                        {char}
                      </div>
                      <div className={`font-mono text-[9px] ${isDarkMode ? "text-neutral-600" : "text-neutral-500"}`}>
                        U+{char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Paragraph Settings ── */}
            <section>
              <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">04 -- Paragraph Settings</h3>
              <div className="space-y-6">
                {[14, 16, 18].map((size) => (
                  <div key={size} className={`border ${borderClass} ${cardBgClass} p-4 sm:p-6 sm:p-8`} style={{ borderRadius: 0 }}>
                    <div className={`font-mono text-xs uppercase tracking-widest text-[#B8963E] mb-4`}>
                      {size}px / {Math.round(size * 1.6)}px leading
                    </div>
                    <p
                      style={{
                        ...specimenStyle,
                        fontSize: `${size}px`,
                        lineHeight: 1.6,
                        maxWidth: `${size * 35}px`,
                      }}
                    >
                      {sampleParagraph}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── OpenType Features ── */}
            {features.length > 0 && (
              <section>
                <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">05 -- OpenType Features</h3>
                <div className={`border ${borderClass} ${cardBgClass} p-4 sm:p-6 sm:p-8`} style={{ borderRadius: 0 }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {features.map((f) => (
                      <label
                        key={f.tag}
                        className={`flex items-center gap-3 px-4 py-3 border cursor-pointer transition-colors ${
                          f.enabled
                            ? "border-[#B8963E] bg-[#B8963E]/5"
                            : `${borderClass} ${isDarkMode ? "hover:border-neutral-700" : "hover:border-neutral-400"}`
                        }`}
                        style={{ borderRadius: 0 }}
                      >
                        <input
                          type="checkbox"
                          checked={f.enabled}
                          onChange={() => toggleFeature(f.tag)}
                          className="accent-[#B8963E]"
                        />
                        <div>
                          <span className="text-xs font-mono text-[#B8963E]">{f.tag}</span>
                          <span className={`text-xs ${isDarkMode ? "text-neutral-500" : "text-neutral-600"} ml-2`}>
                            {f.label}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="text-3xl" style={specimenStyle}>
                    The quick brown fox jumps over the lazy dog 0123456789 fi fl ff ffi ffl
                  </div>
                </div>
              </section>
            )}

            {/* ── Variable Axes ── */}
            {axes.length > 0 && (
              <section>
                <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">06 -- Variable Axes</h3>
                <div className={`border ${borderClass} ${cardBgClass} p-4 sm:p-6 sm:p-8`} style={{ borderRadius: 0 }}>
                  <div className="space-y-6 mb-8">
                    {axes.map((a) => (
                      <div key={a.tag}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-xs font-mono text-[#B8963E]">{a.tag}</span>
                            <span className={`text-xs ${isDarkMode ? "text-neutral-500" : "text-neutral-600"} ml-2`}>
                              {a.name}
                            </span>
                          </div>
                          <span className={`text-xs font-mono ${isDarkMode ? "text-neutral-400" : "text-neutral-600"}`}>
                            {a.value}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-mono ${isDarkMode ? "text-neutral-600" : "text-neutral-500"} w-10`}>
                            {a.min}
                          </span>
                          <input
                            type="range"
                            min={a.min}
                            max={a.max}
                            step={a.tag === "wght" ? 1 : (a.max - a.min) / 100}
                            value={a.value}
                            onChange={(e) => updateAxis(a.tag, Number(e.target.value))}
                            className="flex-1 accent-[#B8963E]"
                          />
                          <span className={`text-xs font-mono ${isDarkMode ? "text-neutral-600" : "text-neutral-500"} w-10 text-right`}>
                            {a.max}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-5xl" style={specimenStyle}>
                    Typography
                  </div>
                </div>
              </section>
            )}

            {/* ── Kerning Pairs ── */}
            <section>
              <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">07 -- Kerning Pairs</h3>
              <div className={`border ${borderClass} ${cardBgClass} p-4 sm:p-6 sm:p-8`} style={{ borderRadius: 0 }}>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-4">
                  {kerningPairs.map((pair) => (
                    <div key={pair} className={`text-center border ${borderClass} p-4`} style={{ borderRadius: 0 }}>
                      <div className="text-4xl mb-2" style={specimenStyle}>
                        {pair}
                      </div>
                      <div className={`font-mono text-xs ${isDarkMode ? "text-neutral-600" : "text-neutral-500"}`}>
                        {pair}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Export ── */}
            <section>
              <div className="flex justify-center">
                <button
                  onClick={exportHTML}
                  className="px-6 py-3 text-sm font-mono uppercase tracking-wider bg-[#B8963E] text-[#0a0a0a] hover:bg-[#d4aa47] transition-colors"
                  style={{ borderRadius: 0 }}
                >
                  Export as HTML
                </button>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          section {
            page-break-inside: avoid;
          }
          button,
          a {
            display: none !important;
          }
        }
      `}</style>

      {/* Footer */}
      <footer className={`border-t ${borderClass} py-12 text-center mt-16`}>
        <p className={`font-mono text-xs uppercase tracking-widest ${isDarkMode ? "text-neutral-600" : "text-neutral-500"}`}>
          Built with care for the craft of typography
        </p>
      </footer>
    </main>
  );
}
