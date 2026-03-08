"use client";

import React, { useState, useEffect, useRef } from "react";
import { typesetText, smoothRagSpans } from "@/lib/typeset";

interface TypographySettings {
  fontSize: number;
  lineHeight: number;
  lineLength: number;
  letterSpacing: number;
  wordSpacing: number;
  fontWeight: number;
  paragraphSpacing: number;
}

const defaultSettings: TypographySettings = {
  fontSize: 16,
  lineHeight: 1.6,
  lineLength: 65,
  letterSpacing: 0,
  wordSpacing: 1,
  fontWeight: 400,
  paragraphSpacing: 1.5,
};

const presets = {
  default: defaultSettings,
  dyslexia: {
    fontSize: 18,
    lineHeight: 1.8,
    lineLength: 60,
    letterSpacing: 0.05,
    wordSpacing: 1.2,
    fontWeight: 500,
    paragraphSpacing: 2,
  },
  compact: {
    fontSize: 14,
    lineHeight: 1.4,
    lineLength: 80,
    letterSpacing: 0,
    wordSpacing: 1,
    fontWeight: 400,
    paragraphSpacing: 1,
  },
  longForm: {
    fontSize: 18,
    lineHeight: 1.65,
    lineLength: 70,
    letterSpacing: 0.01,
    wordSpacing: 1.05,
    fontWeight: 400,
    paragraphSpacing: 2,
  },
};

export default function ReadingLab() {
  const [settings, setSettings] = useState<TypographySettings>(defaultSettings);
  const [previewDark, setPreviewDark] = useState(true);
  const [charsPerLine, setCharsPerLine] = useState(0);

  const updateSetting = (key: keyof TypographySettings, value: number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (presetName: keyof typeof presets) => {
    setSettings(presets[presetName]);
  };

  const calculateComfortScore = (): number => {
    const optimalValues = {
      fontSize: 16,
      lineHeight: 1.6,
      lineLength: 65,
      letterSpacing: 0,
      wordSpacing: 1,
      fontWeight: 400,
      paragraphSpacing: 1.5,
    };

    const ranges = {
      fontSize: { min: 12, max: 24 },
      lineHeight: { min: 1.0, max: 2.5 },
      lineLength: { min: 30, max: 90 },
      letterSpacing: { min: -0.05, max: 0.15 },
      wordSpacing: { min: 0.8, max: 1.5 },
      fontWeight: { min: 300, max: 700 },
      paragraphSpacing: { min: 0, max: 3 },
    };

    let totalScore = 0;
    const keys = Object.keys(optimalValues) as Array<keyof TypographySettings>;

    keys.forEach((key) => {
      const current = settings[key];
      const optimal = optimalValues[key];
      const range = ranges[key];
      const maxDeviation = Math.max(
        Math.abs(range.max - optimal),
        Math.abs(range.min - optimal)
      );
      const deviation = Math.abs(current - optimal);
      const score = Math.max(0, 100 - (deviation / maxDeviation) * 100);
      totalScore += score;
    });

    return Math.round(totalScore / keys.length);
  };

  useEffect(() => {
    // Calculate characters per line based on line length setting
    // This is an approximation
    setCharsPerLine(settings.lineLength);
  }, [settings.lineLength]);

  const previewRef = useRef<HTMLDivElement>(null);
  const [ragSmoothed, setRagSmoothed] = useState(false);

  // Debounced rag smoothing — 1s after settings stop changing
  useEffect(() => {
    setRagSmoothed(false);
    const timer = setTimeout(() => setRagSmoothed(true), 1000);
    return () => clearTimeout(timer);
  }, [settings, previewDark]);

  // Apply rag smoothing from the library after debounce
  useEffect(() => {
    if (!ragSmoothed || !previewRef.current) return;

    const cleanups: (() => void)[] = [];
    const paragraphs = previewRef.current.querySelectorAll<HTMLElement>('p');
    paragraphs.forEach((p) => {
      cleanups.push(smoothRagSpans(p));
    });

    return () => cleanups.forEach((fn) => fn());
  }, [ragSmoothed]);

  const comfortScore = calculateComfortScore();

  // Build non-default CSS properties only
  const cssProps: string[] = [];
  if (settings.fontSize !== 16) cssProps.push(`  font-size: ${settings.fontSize}px;`);
  cssProps.push(`  line-height: ${settings.lineHeight};`);
  cssProps.push(`  max-width: ${settings.lineLength}ch;`);
  if (settings.letterSpacing !== 0) cssProps.push(`  letter-spacing: ${settings.letterSpacing}em;`);
  if (settings.wordSpacing !== 1) cssProps.push(`  word-spacing: ${(settings.wordSpacing - 1).toFixed(2)}em;`);
  if (settings.fontWeight !== 400) cssProps.push(`  font-weight: ${settings.fontWeight};`);
  if (settings.paragraphSpacing !== 0) cssProps.push(`  margin-bottom: ${settings.paragraphSpacing}rem;`);
  cssProps.push(`  text-wrap: pretty;`);

  const generatedCSS = `.readable-text {\n${cssProps.join('\n')}\n}${
    settings.paragraphSpacing !== 0
      ? `\n\n.readable-text p {\n  margin-bottom: ${settings.paragraphSpacing}rem;\n}\n\n.readable-text p:last-child {\n  margin-bottom: 0;\n}`
      : ''
  }`;

  // Build JS snippet showing which typeset rules apply at this measure
  const m = settings.lineLength;
  const activeRules: string[] = [];
  if (m >= 35) activeRules.push('orphan prevention');
  if (m >= 45) activeRules.push('sentence protection');
  if (m >= 55) activeRules.push('short-word binding');

  const generatedJS = `import { typesetText, smoothRag } from 'typeset';

// At ${settings.lineLength}ch measure, active rules:
// ${activeRules.length > 0 ? activeRules.join(', ') : 'none (measure too narrow for binding rules)'}

const element = document.querySelector('.readable-text');

// Step 1: Apply text-level rules (non-breaking spaces)
element.innerHTML = typesetText(element.textContent, {
  measure: ${settings.lineLength}
});

// Step 2: Smooth the rag (per-line word-spacing)
const cleanup = smoothRag(element);

// To undo: cleanup();`;

  const previewText = [
    "Typography is the craft of endowing human language with a durable visual form, and thus with an independent existence. Its heartwood is calligraphy—the dance, on a smaller page, of the living, speaking hand—and its roots reach into living soil, though its branches may be hung with dead conventions.",
    "The reader's comfort is not a luxury but a necessity. When text is set with care—when the spaces between letters breathe properly, when lines are neither cramped nor sprawling, when the eye can traverse a line without fatigue—reading becomes what it should be: transparent. The reader forgets the page and remembers the ideas.",
    "Research in typography and human factors has given us concrete guidance. We know that line lengths between 45 and 75 characters optimize reading speed and comprehension. We understand that line height affects both legibility and aesthetic harmony. We have measured the impact of letter spacing on readers with visual impairments and dyslexia.",
    "These are not arbitrary rules handed down by tradition. They are principles discovered through careful observation of how human eyes and brains process written language. When we set type according to evidence, we honor both the reader and the text.",
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-200 overflow-x-hidden">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-10 sm:py-16 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="mb-12">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            06 -- Reading Comfort Lab
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-playfair mb-4">
            Evidence-Based Typography
          </h1>
          <p className="text-base sm:text-lg text-neutral-400 max-w-3xl font-source-sans" style={{ textWrap: "pretty" }}>
            Adjust each setting and see the visual result alongside the research
            behind it. Find the balance between aesthetics and reading&nbsp;comfort.
          </p>
        </div>

        {/* Comfort Score */}
        <div className="mb-8 border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E]">
              Reading Comfort Score
            </span>
            <span className="text-2xl font-bold text-[#B8963E]">
              {comfortScore}
            </span>
          </div>
          <div className="w-full h-2 bg-neutral-800">
            <div
              className="h-full bg-[#B8963E] transition-all duration-300"
              style={{ width: `${comfortScore}%` }}
            />
          </div>
        </div>

        {/* Main Layout */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Controls Panel */}
          <div className="space-y-6 min-w-0">
            <div className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6">
              <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-6">
                Controls
              </h2>

              {/* Font Size */}
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-sm font-source-sans">Font Size</label>
                  <span className="text-xs text-[#B8963E]">
                    {settings.fontSize}px
                  </span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="24"
                  step="1"
                  value={settings.fontSize}
                  onChange={(e) =>
                    updateSetting("fontSize", parseFloat(e.target.value))
                  }
                  className="w-full accent-[#B8963E]"
                />
                <p className="text-xs text-neutral-500 mt-2 font-source-sans">
                  16px minimum for body text on screens (WCAG 2.1)
                </p>
              </div>

              {/* Line Height */}
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-sm font-source-sans">
                    Line Height
                  </label>
                  <span className="text-xs text-[#B8963E]">
                    {settings.lineHeight.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="2.5"
                  step="0.05"
                  value={settings.lineHeight}
                  onChange={(e) =>
                    updateSetting("lineHeight", parseFloat(e.target.value))
                  }
                  className="w-full accent-[#B8963E]"
                />
                <p className="text-xs text-neutral-500 mt-2 font-source-sans">
                  1.5-1.7 optimal for body text (Ling & van Schaik, 2007)
                </p>
              </div>

              {/* Line Length */}
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-sm font-source-sans">
                    Line Length
                  </label>
                  <span className="text-xs text-[#B8963E]">
                    {settings.lineLength}ch
                  </span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="90"
                  step="1"
                  value={settings.lineLength}
                  onChange={(e) =>
                    updateSetting("lineLength", parseFloat(e.target.value))
                  }
                  className="w-full accent-[#B8963E]"
                />
                <p className="text-xs text-neutral-500 mt-2 font-source-sans">
                  45-75 characters per line optimal (Bringhurst, Elements of
                  Typographic Style)
                </p>
              </div>

              {/* Letter Spacing */}
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-sm font-source-sans">
                    Letter Spacing
                  </label>
                  <span className="text-xs text-[#B8963E]">
                    {settings.letterSpacing.toFixed(3)}em
                  </span>
                </div>
                <input
                  type="range"
                  min="-0.05"
                  max="0.15"
                  step="0.005"
                  value={settings.letterSpacing}
                  onChange={(e) =>
                    updateSetting("letterSpacing", parseFloat(e.target.value))
                  }
                  className="w-full accent-[#B8963E]"
                />
                <p className="text-xs text-neutral-500 mt-2 font-source-sans">
                  Slight positive tracking improves readability at small sizes
                  (Arditi & Cho, 2005)
                </p>
              </div>

              {/* Word Spacing */}
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-sm font-source-sans">
                    Word Spacing
                  </label>
                  <span className="text-xs text-[#B8963E]">
                    {settings.wordSpacing.toFixed(2)}em
                  </span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.5"
                  step="0.05"
                  value={settings.wordSpacing}
                  onChange={(e) =>
                    updateSetting("wordSpacing", parseFloat(e.target.value))
                  }
                  className="w-full accent-[#B8963E]"
                />
                <p className="text-xs text-neutral-500 mt-2 font-source-sans">
                  Increased word spacing aids readers with dyslexia (Zorzi et
                  al., 2012)
                </p>
              </div>

              {/* Font Weight */}
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-sm font-source-sans">
                    Font Weight
                  </label>
                  <span className="text-xs text-[#B8963E]">
                    {settings.fontWeight}
                  </span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="700"
                  step="100"
                  value={settings.fontWeight}
                  onChange={(e) =>
                    updateSetting("fontWeight", parseFloat(e.target.value))
                  }
                  className="w-full accent-[#B8963E]"
                />
                <p className="text-xs text-neutral-500 mt-2 font-source-sans">
                  Regular weight (400) optimal for extended reading
                </p>
              </div>

              {/* Paragraph Spacing */}
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-sm font-source-sans">
                    Paragraph Spacing
                  </label>
                  <span className="text-xs text-[#B8963E]">
                    {settings.paragraphSpacing.toFixed(2)}rem
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.25"
                  value={settings.paragraphSpacing}
                  onChange={(e) =>
                    updateSetting(
                      "paragraphSpacing",
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full accent-[#B8963E]"
                />
                <p className="text-xs text-neutral-500 mt-2 font-source-sans">
                  Adequate paragraph spacing improves text navigation
                </p>
              </div>
            </div>

            {/* Presets */}
            <div className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6">
              <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
                Presets
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => applyPreset("dyslexia")}
                  className="border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-4 py-3 text-sm transition-colors font-source-sans"
                >
                  Dyslexia-Friendly
                </button>
                <button
                  onClick={() => applyPreset("compact")}
                  className="border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-4 py-3 text-sm transition-colors font-source-sans"
                >
                  Compact
                </button>
                <button
                  onClick={() => applyPreset("longForm")}
                  className="border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-4 py-3 text-sm transition-colors font-source-sans"
                >
                  Long-Form
                </button>
                <button
                  onClick={() => applyPreset("default")}
                  className="border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-4 py-3 text-sm transition-colors font-source-sans"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="space-y-4 min-w-0">
            <div className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6 min-w-0 overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E]">
                  Live Preview
                </h2>
                <button
                  onClick={() => setPreviewDark(!previewDark)}
                  className="border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-4 py-2 text-xs font-source-sans transition-colors"
                >
                  {previewDark ? "Light Mode" : "Dark Mode"}
                </button>
              </div>

              <div
                className={`p-4 sm:p-6 lg:p-8 transition-colors overflow-x-auto ${
                  previewDark
                    ? "bg-neutral-900 text-neutral-200"
                    : "bg-white text-neutral-900"
                }`}
              >
                <div
                  ref={previewRef}
                  style={{
                    fontSize: `${settings.fontSize}px`,
                    lineHeight: settings.lineHeight,
                    maxWidth: `min(${settings.lineLength}ch, 100%)`,
                    letterSpacing: `${settings.letterSpacing}em`,
                    wordSpacing: `${(settings.wordSpacing - 1).toFixed(2)}em`,
                    fontWeight: settings.fontWeight,
                    textWrap: 'pretty' as any,
                    overflowWrap: 'break-word',
                  }}
                  className="font-source-sans"
                >
                  {previewText.map((paragraph, index) => {
                    // Split into words, render each as a span for rag measurement
                    const processed = typesetText(paragraph, { measure: settings.lineLength });
                    const words = processed.split(/[ \u00A0]+/).filter(Boolean);
                    return (
                      <p
                        key={index}
                        style={{
                          marginBottom:
                            index < previewText.length - 1
                              ? `${settings.paragraphSpacing}rem`
                              : 0,
                        }}
                      >
                        {words.map((word, wi) => (
                          <React.Fragment key={wi}>
                            {wi > 0 && ' '}
                            <span data-w={wi}>{word}</span>
                          </React.Fragment>
                        ))}
                      </p>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 text-xs text-neutral-500 font-mono">
                Characters per line: ~{charsPerLine}
              </div>
            </div>

            {/* Generated Code */}
            <div className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6 min-w-0 overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E]">
                  Generated CSS
                </h2>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedCSS);
                  }}
                  className="border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-4 py-2 text-xs font-source-sans transition-colors flex-shrink-0"
                >
                  Copy CSS
                </button>
              </div>
              <pre className="text-xs sm:text-sm font-mono text-neutral-300 bg-neutral-900 p-4 sm:p-6 overflow-x-auto whitespace-pre leading-relaxed">
                {generatedCSS}
              </pre>
            </div>

            {/* Generated JS (typeset rules) */}
            <div className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6 min-w-0 overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E]">
                  Typeset.js Rules
                </h2>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedJS);
                  }}
                  className="border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-4 py-2 text-xs font-source-sans transition-colors flex-shrink-0"
                >
                  Copy JS
                </button>
              </div>
              <pre className="text-xs sm:text-sm font-mono text-neutral-300 bg-neutral-900 p-4 sm:p-6 overflow-x-auto whitespace-pre leading-relaxed">
                {generatedJS}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
