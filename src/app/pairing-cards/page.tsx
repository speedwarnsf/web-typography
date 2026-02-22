"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { typesetText } from "@/lib/typeset";

const POPULAR_FONTS = [
  "Playfair Display", "Inter", "Lora", "Source Sans 3", "Space Grotesk",
  "Crimson Pro", "DM Serif Display", "DM Sans", "Cormorant Garamond",
  "Fira Sans", "Sora", "Merriweather", "Libre Baskerville", "Nunito Sans",
  "Oswald", "EB Garamond", "Raleway", "Bitter", "Work Sans", "Spectral",
  "Roboto", "Roboto Slab", "Montserrat", "Open Sans", "Poppins", "Lato",
  "PT Serif", "PT Sans", "Noto Serif", "Noto Sans", "Alegreya",
  "Alegreya Sans", "IBM Plex Serif", "IBM Plex Sans", "Josefin Sans",
  "Josefin Slab", "Archivo", "Archivo Narrow", "Barlow", "Barlow Condensed",
  "Cabin", "Cantarell", "Chivo", "Domine", "Exo 2", "Gentium Book Plus",
  "Inconsolata", "Karla", "Lexend", "Manrope", "Maven Pro", "Mulish",
  "Neuton", "Noticia Text", "Nunito", "Old Standard TT", "Outfit",
  "Overpass", "Oxygen", "Philosopher", "Proza Libre", "Quicksand",
  "Red Hat Display", "Rubik", "Signika", "Tinos", "Titillium Web",
  "Ubuntu", "Urbanist", "Vollkorn", "Zilla Slab",
].sort();

const LOREM = "Good typography is invisible. Great typography speaks to the reader without ever being noticed. It carries meaning through form, guides the eye with rhythm, and transforms raw content into an experience worth having. The difference between adequate and exceptional design often comes down to the smallest details: the space between letters, the length of a line, the weight of a stroke. These decisions accumulate into something the reader feels but cannot name.";

function loadGoogleFont(fontName: string) {
  const id = `gf-${fontName.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;600;700&display=swap`;
  document.head.appendChild(link);
}

function FontSearch({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query
    ? POPULAR_FONTS.filter((f) => f.toLowerCase().includes(query.toLowerCase()))
    : POPULAR_FONTS;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-[#B8963E] transition-colors"
      >
        {value}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-neutral-900 border border-neutral-700 max-h-64 overflow-y-auto">
          <input
            type="text"
            placeholder="Search fonts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-neutral-800 border-b border-neutral-700 px-3 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-600"
            autoFocus
          />
          {filtered.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                onChange(f);
                setOpen(false);
                setQuery("");
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-neutral-800 transition-colors ${
                f === value ? "text-[#B8963E]" : "text-neutral-300"
              }`}
            >
              {f}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-neutral-600">No matches</p>
          )}
        </div>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
          {label}
        </label>
        <span className="font-mono text-[11px] text-neutral-400">
          {value}{unit || ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#B8963E] h-1"
      />
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={`#${value}`}
          onChange={(e) => onChange(e.target.value.replace("#", ""))}
          className="w-8 h-8 border border-neutral-700 bg-transparent cursor-pointer p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.replace("#", ""))}
          className="flex-1 bg-neutral-900 border border-neutral-700 px-2 py-1 text-sm font-mono text-neutral-300 outline-none"
          maxLength={6}
        />
      </div>
    </div>
  );
}

function PairingCardBuilder() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [heading, setHeading] = useState(searchParams.get("heading") || "Playfair Display");
  const [body, setBody] = useState(searchParams.get("body") || "Inter");
  const [hSize, setHSize] = useState(Number(searchParams.get("hSize")) || 48);
  const [bSize, setBSize] = useState(Number(searchParams.get("bSize")) || 18);
  const [leading, setLeading] = useState(Number(searchParams.get("leading")) || 1.5);
  const [colW, setColW] = useState(Number(searchParams.get("colW")) || 65);
  const [bg, setBg] = useState(searchParams.get("bg") || "0a0a0a");
  const [fg, setFg] = useState(searchParams.get("fg") || "e0e0e0");
  const [hColor, setHColor] = useState(searchParams.get("hc") || "");
  const [bColor, setBColor] = useState(searchParams.get("bc") || "");
  const [useCustomText, setUseCustomText] = useState(false);
  const [customText, setCustomText] = useState("");
  const [headingText, setHeadingText] = useState("The Art of Typography");

  const specimenRef = useRef<HTMLDivElement>(null);
  const [generatedImages, setGeneratedImages] = useState<{label: string; dataUrl: string; width: number; height: number}[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadGoogleFont(heading); }, [heading]);
  useEffect(() => { loadGoogleFont(body); }, [body]);

  const updateURL = useCallback(() => {
    const params = new URLSearchParams({
      heading, body,
      hSize: String(hSize), bSize: String(bSize),
      leading: String(leading), colW: String(colW),
      bg, fg,
      ...(hColor ? { hc: hColor } : {}),
      ...(bColor ? { bc: bColor } : {}),
    });
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [heading, body, hSize, bSize, leading, colW, bg, fg, hColor, bColor, router]);

  useEffect(() => { updateURL(); }, [updateURL]);

  const rawText = useCustomText && customText ? customText : LOREM;
  const displayText = typesetText(rawText);

  const generatePNG = async (width: number, height: number, label: string): Promise<string> => {
    const { default: html2canvas } = await import("html2canvas-pro");

    const container = document.createElement("div");
    container.style.cssText = `
      position: fixed; left: -9999px; top: 0;
      width: ${width}px; height: ${height}px;
      background: #${bg}; color: #${fg};
      display: flex; flex-direction: column; justify-content: center;
      padding: ${width > 500 ? "80px" : "40px"};
      box-sizing: border-box;
      overflow: hidden;
    `;

    container.innerHTML = `
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; max-width: ${colW}ch;">
        <h1 style="font-family: '${heading}', serif; font-size: ${hSize * (width > 500 ? 1 : 0.7)}px; line-height: 1.15; margin: 0 0 ${width > 500 ? 32 : 20}px 0; font-weight: 700; color: #${hColor || fg};">
          ${typesetText(headingText)}
        </h1>
        <p style="font-family: '${body}', sans-serif; font-size: ${bSize * (width > 500 ? 1 : 0.9)}px; line-height: ${leading}; margin: 0; color: #${bColor || fg};">
          ${displayText}
        </p>
      </div>
      <div style="font-family: monospace; font-size: 10px; color: #${fg}44; margin-top: auto; padding-top: 24px; letter-spacing: 0.1em; text-transform: uppercase;">
        ${heading} ${hSize}px / ${body} ${bSize}px / Leading ${leading}<br/>
        <span style="font-size: 9px;">fonts.google.com -- web-typography.vercel.app</span>
      </div>
    `;

    document.body.appendChild(container);
    await new Promise((r) => setTimeout(r, 500));

    const canvas = await html2canvas(container, {
      width, height, scale: 2,
      backgroundColor: `#${bg}`,
      useCORS: true,
    });

    document.body.removeChild(container);
    return canvas.toDataURL("image/png");
  };

  const generateBoth = async () => {
    setGenerating(true);
    setGeneratedImages([]);
    try {
      const [mobile, square] = await Promise.all([
        generatePNG(390, 844, "mobile"),
        generatePNG(1080, 1080, "square"),
      ]);
      setGeneratedImages([
        { label: "Mobile", dataUrl: mobile, width: 390, height: 844 },
        { label: "Square", dataUrl: square, width: 1080, height: 1080 },
      ]);
    } finally {
      setGenerating(false);
    }
  };

  const googleFontsUrl = (font: string) =>
    `https://fonts.google.com/specimen/${encodeURIComponent(font.replace(/\s+/g, "+"))}`;

  const generatedCSS = `/* Font Pairing: ${heading} + ${body} */
/* Google Fonts import */
@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(heading)}:wght@400;700&family=${encodeURIComponent(body)}:wght@400;600&display=swap');

:root {
  --heading-font: '${heading}', serif;
  --body-font: '${body}', sans-serif;
  --heading-size: ${hSize}px;
  --body-size: ${bSize}px;
  --leading: ${leading};
  --col-width: ${colW}ch;
  --bg: #${bg};
  --heading-color: #${hColor || fg};
  --body-color: #${bColor || fg};
}

body {
  background: var(--bg);
  font-family: var(--body-font);
  font-size: var(--body-size);
  line-height: var(--leading);
  color: var(--body-color);
  max-width: var(--col-width);
}

h1, h2, h3 {
  font-family: var(--heading-font);
  font-size: var(--heading-size);
  line-height: 1.15;
  font-weight: 700;
  color: var(--heading-color);
}`;

  const generatedHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading} + ${body} Type Specimen</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(heading)}:wght@400;700&family=${encodeURIComponent(body)}:wght@400;600&display=swap">
  <style>
    body {
      margin: 0;
      padding: clamp(24px, 4vw, 80px);
      background: #${bg};
      font-family: '${body}', sans-serif;
      font-size: ${bSize}px;
      line-height: ${leading};
      color: #${bColor || fg};
      max-width: ${colW}ch;
    }
    h1 {
      font-family: '${heading}', serif;
      font-size: ${hSize}px;
      line-height: 1.15;
      font-weight: 700;
      color: #${hColor || fg};
      margin: 0 0 0.5em;
    }
    p { margin: 0; }
  </style>
</head>
<body>
  <h1>${headingText}</h1>
  <p>${rawText}</p>
</body>
</html>`;

  const [showCode, setShowCode] = useState(false);
  const [copiedField, setCopiedField] = useState("");


  const downloadImage = (dataUrl: string, label: string) => {
    const link = document.createElement("a");
    link.download = `type-specimen-${label.toLowerCase()}-${heading.replace(/\s+/g, "-")}-${body.replace(/\s+/g, "-")}.png`;
    link.href = dataUrl;
    link.click();
  };

  const shareImage = async (dataUrl: string, label: string) => {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `type-specimen-${label.toLowerCase()}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${heading} + ${body} Type Specimen`,
          text: `Font pairing: ${heading} / ${body} -- ${hSize}px / ${bSize}px / Leading ${leading}`,
          files: [file],
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Link copied to clipboard");
      }
    } catch (e) {
      // User cancelled share or not supported
    }
  };

  return (
    <main className="min-h-screen" style={{ background: "#0a0a0a" }}>
      {/* Header */}
      <header className="border-b border-neutral-800 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <a href="/" className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-500 hover:text-[#B8963E] transition-colors">
              Web Typography
            </a>
            <h1
              className="text-2xl font-bold tracking-tight mt-1"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Font Pairing Cards
            </h1>
          </div>
          <button
            onClick={generateBoth}
            disabled={generating}
            className="border border-[#B8963E] bg-[#B8963E]/10 px-6 py-2 text-xs font-mono uppercase tracking-widest text-[#B8963E] hover:bg-[#B8963E]/20 transition-colors disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Cards"}
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row">
        {/* Controls */}
        <aside className="w-full lg:w-80 lg:min-w-[320px] border-r border-neutral-800 p-6 space-y-5 lg:min-h-[calc(100vh-80px)] lg:sticky lg:top-0 lg:overflow-y-auto">
          <FontSearch label="Heading Font" value={heading} onChange={setHeading} />
          <FontSearch label="Body Font" value={body} onChange={setBody} />

          <div className="flex gap-3 text-[10px] font-mono uppercase tracking-widest">
            <a
              href={googleFontsUrl(heading)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-[#B8963E] transition-colors underline underline-offset-2"
            >
              {heading} source
            </a>
            <span className="text-neutral-700">/</span>
            <a
              href={googleFontsUrl(body)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-[#B8963E] transition-colors underline underline-offset-2"
            >
              {body} source
            </a>
          </div>

          <div className="border-t border-neutral-800 pt-5">
            <Slider label="Heading Size" value={hSize} onChange={setHSize} min={16} max={120} step={1} unit="px" />
          </div>
          <Slider label="Body Size" value={bSize} onChange={setBSize} min={10} max={36} step={1} unit="px" />
          <Slider label="Line Height" value={leading} onChange={setLeading} min={1} max={2.5} step={0.05} />
          <Slider label="Column Width" value={colW} onChange={setColW} min={20} max={100} step={1} unit="ch" />

          <div className="border-t border-neutral-800 pt-5 space-y-4">
            <ColorInput label="Background" value={bg} onChange={setBg} />
            <ColorInput label="Heading Color" value={hColor || fg} onChange={setHColor} />
            <ColorInput label="Body Color" value={bColor || fg} onChange={setBColor} />
            <div>
              <button
                type="button"
                onClick={() => { setHColor(""); setBColor(""); }}
                className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-[#B8963E] transition-colors"
              >
                Reset to unified color
              </button>
              {(!hColor && !bColor) && (
                <div className="mt-1">
                  <ColorInput label="Base Type Color" value={fg} onChange={setFg} />
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-neutral-800 pt-5">
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                Text Content
              </label>
              <button
                type="button"
                onClick={() => setUseCustomText(!useCustomText)}
                className="font-mono text-[10px] uppercase tracking-widest text-[#B8963E] hover:underline"
              >
                {useCustomText ? "Use Default" : "Custom Text"}
              </button>
            </div>
            <input
              type="text"
              value={headingText}
              onChange={(e) => setHeadingText(e.target.value)}
              placeholder="Heading text..."
              className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 outline-none mb-2 placeholder:text-neutral-600"
            />
            {useCustomText && (
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Enter your body text..."
                rows={4}
                className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 outline-none resize-y placeholder:text-neutral-600"
              />
            )}
          </div>

          <div className="border-t border-neutral-800 pt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
              Share URL
            </p>
            <button
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              className="w-full border border-neutral-700 px-3 py-2 text-xs font-mono text-neutral-400 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors"
            >
              Copy Link
            </button>
          </div>
        </aside>

        {/* Preview + Generated Images */}
        <div className="flex-1 p-6 lg:p-12 flex flex-col items-center min-h-[calc(100vh-80px)] gap-12">
          {/* Live Preview */}
          <div
            ref={specimenRef}
            className="w-full border border-neutral-800 transition-colors duration-200"
            style={{
              background: `#${bg}`,
              color: `#${fg}`,
              maxWidth: `${colW}ch`,
              padding: "clamp(24px, 4vw, 64px)",
            }}
          >
            <h2
              style={{
                fontFamily: `'${heading}', serif`,
                fontSize: `${hSize}px`,
                lineHeight: 1.15,
                fontWeight: 700,
                margin: "0 0 0.5em 0",
                color: hColor ? `#${hColor}` : undefined,
              }}
            >
              {typesetText(headingText)}
            </h2>
            <p
              style={{
                fontFamily: `'${body}', sans-serif`,
                fontSize: `${bSize}px`,
                lineHeight: leading,
                margin: 0,
                color: bColor ? `#${bColor}` : undefined,
              }}
            >
              {displayText}
            </p>
            <div
              className="mt-8 pt-4 border-t"
              style={{ borderColor: `#${fg}22` }}
            >
              <p
                className="font-mono uppercase tracking-widest"
                style={{ fontSize: "10px", color: `#${fg}44` }}
              >
                {heading} {hSize}px / {body} {bSize}px / Leading {leading}
              </p>
            </div>
          </div>

          {/* Generated Image Cards */}
          {generatedImages.length > 0 && (
            <div className="w-full max-w-4xl space-y-10">
              <div className="border-t border-neutral-800 pt-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-500 mb-6">
                  Generated Cards -- hold to save to photos
                </p>
              </div>
              {generatedImages.map((img) => (
                <div key={img.label} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-400">
                      {img.label} ({img.width} x {img.height})
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadImage(img.dataUrl, img.label)}
                        className="border border-neutral-700 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-400 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => shareImage(img.dataUrl, img.label)}
                        className="border border-neutral-700 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-400 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors"
                      >
                        Share
                      </button>
                    </div>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.dataUrl}
                    alt={`${img.label} type specimen: ${heading} + ${body}`}
                    className="w-full border border-neutral-800"
                    style={{ imageRendering: "auto" }}
                  />
                </div>
              ))}

              {/* Code Export */}
              <div className="border-t border-neutral-800 pt-6 mt-10">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-500">
                    Code Export
                  </p>
                  <button
                    onClick={() => setShowCode(!showCode)}
                    className="font-mono text-[10px] uppercase tracking-widest text-[#B8963E] hover:underline"
                  >
                    {showCode ? "Hide Code" : "Show Code"}
                  </button>
                </div>

                {showCode && (
                  <div className="space-y-6">
                    {/* CSS */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">CSS</p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedCSS);
                            setCopiedField("css");
                            setTimeout(() => setCopiedField(""), 2000);
                          }}
                          className="border border-neutral-700 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-neutral-400 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors"
                        >
                          {copiedField === "css" ? "Copied" : "Copy CSS"}
                        </button>
                      </div>
                      <pre className="bg-neutral-950 border border-neutral-800 p-4 overflow-x-auto text-[12px] font-mono text-neutral-400 leading-relaxed whitespace-pre-wrap">
                        {generatedCSS}
                      </pre>
                    </div>

                    {/* HTML */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">HTML</p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedHTML);
                            setCopiedField("html");
                            setTimeout(() => setCopiedField(""), 2000);
                          }}
                          className="border border-neutral-700 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-neutral-400 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors"
                        >
                          {copiedField === "html" ? "Copied" : "Copy HTML"}
                        </button>
                      </div>
                      <pre className="bg-neutral-950 border border-neutral-800 p-4 overflow-x-auto text-[12px] font-mono text-neutral-400 leading-relaxed whitespace-pre-wrap">
                        {generatedHTML}
                      </pre>
                    </div>

                    {/* Share Code */}
                    <button
                      onClick={async () => {
                        const codeBundle = `/* === CSS === */\n${generatedCSS}\n\n/* === HTML === */\n${generatedHTML}`;
                        if (navigator.share) {
                          try {
                            const file = new File([codeBundle], `type-specimen-${heading.replace(/\s+/g, "-")}-${body.replace(/\s+/g, "-")}.txt`, { type: "text/plain" });
                            if (navigator.canShare({ files: [file] })) {
                              await navigator.share({
                                title: `${heading} + ${body} Type Specimen Code`,
                                files: [file],
                              });
                              return;
                            }
                          } catch {}
                        }
                        await navigator.clipboard.writeText(`/* === CSS === */\n${generatedCSS}\n\n/* === HTML === */\n${generatedHTML}`);
                        setCopiedField("all");
                        setTimeout(() => setCopiedField(""), 2000);
                      }}
                      className="w-full border border-[#B8963E] bg-[#B8963E]/10 px-4 py-2.5 text-[10px] font-mono uppercase tracking-widest text-[#B8963E] hover:bg-[#B8963E]/20 transition-colors"
                    >
                      {copiedField === "all" ? "Copied to clipboard" : "Share All Code"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function PairingCardsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <PairingCardBuilder />
    </Suspense>
  );
}
