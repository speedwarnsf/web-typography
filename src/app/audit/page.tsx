"use client";

import { useState, useRef, useMemo } from "react";
import CodeBlock from "@/components/CodeBlock";

/* ── Types ── */
type AuditCheck = {
  id: string;
  name: string;
  score: number;
  status: "pass" | "warn" | "fail";
  findings: string[];
  recommendation: string;
  fix?: string;
};

type AuditResult = {
  overallScore: number;
  checks: AuditCheck[];
};

/* ── Sample HTML with common issues ── */
const SAMPLE_HTML = `<article>
  <h1>The Future of Typography</h1>
  <p>Typography is the art and technique of arranging type to make written language legible, readable and appealing.</p>
  <h3>Why Typography Matters</h3>
  <p>Good typography enhances the reading experience and helps communicate your message effectively to your audience.</p>
  <p>It creates hierarchy, harmony, and helps guide the reader through your content in a meaningful way.</p>
  <h2>Common Mistakes</h2>
  <p style="font-size: 12px; line-height: 1.2; color: #888; background: #fff;">Small text with poor contrast and tight leading can be very difficult to read for many people.</p>
  <p>A very long line of text that extends beyond the recommended character limit of seventy-five characters per line can make reading difficult and tiring for users.</p>
</article>`;

/* ── Audit Utilities ── */
function countOrphans(container: HTMLElement): { count: number; elements: string[] } {
  const paragraphs = container.querySelectorAll("p");
  const orphans: string[] = [];
  let count = 0;

  paragraphs.forEach((p, idx) => {
    const text = p.textContent?.trim() || "";
    const words = text.split(/\s+/);
    if (words.length > 1) {
      const lastWord = words[words.length - 1];
      // Simple heuristic: if last word is short and preceded by space
      if (lastWord.length <= 8 && words.length > 3) {
        count++;
        orphans.push(`Paragraph ${idx + 1}: "${text.slice(0, 50)}..."`);
      }
    }
  });

  return { count, elements: orphans };
}

function checkLineLength(container: HTMLElement): {
  violations: number;
  distribution: { short: number; optimal: number; long: number };
  elements: string[];
} {
  const paragraphs = container.querySelectorAll("p");
  const distribution = { short: 0, optimal: 0, long: 0 };
  let violations = 0;
  const problematic: string[] = [];

  paragraphs.forEach((p, idx) => {
    const text = p.textContent?.trim() || "";
    const charCount = text.length;

    if (charCount === 0) return;

    if (charCount < 45) {
      distribution.short++;
      violations++;
      problematic.push(`Paragraph ${idx + 1}: ${charCount} chars (too short)`);
    } else if (charCount > 75) {
      distribution.long++;
      violations++;
      problematic.push(`Paragraph ${idx + 1}: ${charCount} chars (too long)`);
    } else {
      distribution.optimal++;
    }
  });

  return { violations, distribution, elements: problematic };
}

function checkLineHeight(container: HTMLElement): { violations: string[]; avgLineHeight: number } {
  const elements = container.querySelectorAll("p, li, blockquote");
  const violations: string[] = [];
  let totalLineHeight = 0;
  let count = 0;

  elements.forEach((el, idx) => {
    const computed = window.getComputedStyle(el);
    const lineHeight = parseFloat(computed.lineHeight);
    const fontSize = parseFloat(computed.fontSize);
    const ratio = lineHeight / fontSize;

    if (!isNaN(ratio)) {
      totalLineHeight += ratio;
      count++;

      if (ratio < 1.4 || ratio > 2.0) {
        violations.push(
          `Element ${idx + 1}: line-height ratio ${ratio.toFixed(2)} (optimal: 1.5-1.7)`
        );
      }
    }
  });

  return {
    violations,
    avgLineHeight: count > 0 ? totalLineHeight / count : 0,
  };
}

function checkFontSize(container: HTMLElement): { violations: string[] } {
  const textElements = container.querySelectorAll("p, li, span, div");
  const violations: string[] = [];

  textElements.forEach((el, idx) => {
    const computed = window.getComputedStyle(el);
    const fontSize = parseFloat(computed.fontSize);

    if (fontSize < 16 && el.textContent?.trim()) {
      violations.push(`Element ${idx + 1}: ${fontSize}px (minimum: 16px)`);
    }
  });

  return { violations };
}

function checkHeadingHierarchy(container: HTMLElement): { violations: string[] } {
  const headings = Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  const violations: string[] = [];
  let lastLevel = 0;

  headings.forEach((h) => {
    const level = parseInt(h.tagName[1]);
    if (lastLevel > 0 && level > lastLevel + 1) {
      violations.push(
        `Skipped heading level: ${h.tagName} after h${lastLevel} (${h.textContent?.slice(0, 30)}...)`
      );
    }
    lastLevel = level;
  });

  return { violations };
}

function checkShortWordStranding(container: HTMLElement): { count: number; examples: string[] } {
  const shortWords = /\b(a|an|the|in|on|at|to|by|of|or|and|but|for|nor|yet|so)\b/gi;
  const paragraphs = container.querySelectorAll("p");
  let count = 0;
  const examples: string[] = [];

  paragraphs.forEach((p, idx) => {
    const text = p.textContent?.trim() || "";
    const words = text.split(/\s+/);
    const lastWord = words[words.length - 1]?.toLowerCase();

    if (lastWord && ["a", "an", "the", "in", "on", "at", "to", "by", "of", "or", "and", "but", "for", "nor", "yet", "so"].includes(lastWord)) {
      count++;
      examples.push(`Paragraph ${idx + 1} ends with "${lastWord}"`);
    }
  });

  return { count, examples };
}

function checkTextWrap(container: HTMLElement): { missing: string[] } {
  const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const paragraphs = container.querySelectorAll("p");
  const missing: string[] = [];

  headings.forEach((h, idx) => {
    const computed = window.getComputedStyle(h);
    if (!computed.textWrap.includes("balance")) {
      missing.push(`${h.tagName} ${idx + 1}: missing text-wrap: balance`);
    }
  });

  paragraphs.forEach((p, idx) => {
    const computed = window.getComputedStyle(p);
    if (!computed.textWrap.includes("pretty") && !computed.textWrap.includes("balance")) {
      missing.push(`Paragraph ${idx + 1}: missing text-wrap: pretty`);
    }
  });

  return { missing };
}

function checkContrast(container: HTMLElement): { violations: string[] } {
  const textElements = container.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, span");
  const violations: string[] = [];

  textElements.forEach((el, idx) => {
    if (!el.textContent?.trim()) return;

    const computed = window.getComputedStyle(el);
    const color = computed.color;
    const bgColor = computed.backgroundColor;

    // Parse RGB values
    const parseRGB = (str: string) => {
      const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : null;
    };

    const fg = parseRGB(color);
    const bg = parseRGB(bgColor);

    if (!fg || !bg) return;

    // Calculate relative luminance
    const getLuminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => {
        v = v / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const l1 = getLuminance(fg);
    const l2 = getLuminance(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    if (ratio < 4.5) {
      violations.push(
        `${el.tagName} ${idx + 1}: contrast ratio ${ratio.toFixed(2)}:1 (WCAG AA requires 4.5:1)`
      );
    }
  });

  return { violations };
}

function checkVerticalRhythm(container: HTMLElement): { consistent: boolean; findings: string[] } {
  const elements = container.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li");
  const margins = new Set<number>();
  const findings: string[] = [];

  elements.forEach((el) => {
    const computed = window.getComputedStyle(el);
    const marginTop = parseFloat(computed.marginTop);
    const marginBottom = parseFloat(computed.marginBottom);
    if (marginTop > 0) margins.add(marginTop);
    if (marginBottom > 0) margins.add(marginBottom);
  });

  const marginArray = Array.from(margins).sort((a, b) => a - b);

  // Check if margins follow a consistent scale (multiples of a base unit)
  if (marginArray.length > 1) {
    const gcd = marginArray.reduce((a, b) => {
      while (b) {
        const t = b;
        b = a % b;
        a = t;
      }
      return a;
    });

    if (gcd < 4) {
      findings.push("Margins don't follow a consistent vertical rhythm");
    } else {
      findings.push(`Base unit appears to be ${gcd}px`);
    }
  }

  return {
    consistent: findings.length === 1 && findings[0].includes("Base unit"),
    findings,
  };
}

function checkOpenTypeFeatures(container: HTMLElement): { missing: string[] } {
  const elements = container.querySelectorAll("p, h1, h2, h3, h4, h5, h6");
  const missing: string[] = [];
  let hasFeatures = false;

  elements.forEach((el, idx) => {
    const computed = window.getComputedStyle(el);
    const features = computed.fontFeatureSettings;
    if (features !== "normal" && features !== '""') {
      hasFeatures = true;
    }
  });

  if (!hasFeatures) {
    missing.push("No font-feature-settings detected. Consider enabling ligatures and kerning.");
  }

  return { missing };
}

/* ── Main Audit Function ── */
function performAudit(html: string): AuditResult {
  // Create sandboxed container
  const container = document.createElement("div");
  container.innerHTML = html;
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.width = "600px"; // Simulate a reasonable reading width
  document.body.appendChild(container);

  const checks: AuditCheck[] = [];

  // 1. Orphans
  const orphanCheck = countOrphans(container);
  const orphanScore = Math.max(0, 100 - orphanCheck.count * 10);
  checks.push({
    id: "orphans",
    name: "Orphans",
    score: orphanScore,
    status: orphanScore >= 80 ? "pass" : orphanScore >= 50 ? "warn" : "fail",
    findings: orphanCheck.count === 0
      ? ["No orphans detected"]
      : [`Found ${orphanCheck.count} potential orphan(s)`, ...orphanCheck.elements.slice(0, 3)],
    recommendation: "Use text-wrap: balance on headings and text-wrap: pretty on paragraphs",
    fix: `h1, h2, h3, h4, h5, h6 {
  text-wrap: balance;
}

p {
  text-wrap: pretty;
}`,
  });

  // 2. Line Length
  const lineLengthCheck = checkLineLength(container);
  const lineLengthScore = Math.max(0, 100 - lineLengthCheck.violations * 15);
  checks.push({
    id: "line-length",
    name: "Line Length",
    score: lineLengthScore,
    status: lineLengthScore >= 80 ? "pass" : lineLengthScore >= 50 ? "warn" : "fail",
    findings: [
      `Short: ${lineLengthCheck.distribution.short}, Optimal: ${lineLengthCheck.distribution.optimal}, Long: ${lineLengthCheck.distribution.long}`,
      ...lineLengthCheck.elements.slice(0, 3),
    ],
    recommendation: "Keep line length between 45-75 characters for optimal readability",
    fix: `p {
  max-width: 65ch;
}`,
  });

  // 3. Line Height
  const lineHeightCheck = checkLineHeight(container);
  const lineHeightScore = Math.max(0, 100 - lineHeightCheck.violations.length * 15);
  checks.push({
    id: "line-height",
    name: "Line Height",
    score: lineHeightScore,
    status: lineHeightScore >= 80 ? "pass" : lineHeightScore >= 50 ? "warn" : "fail",
    findings: lineHeightCheck.violations.length === 0
      ? [`Average line-height: ${lineHeightCheck.avgLineHeight.toFixed(2)} (Good)`]
      : lineHeightCheck.violations.slice(0, 3),
    recommendation: "Use line-height between 1.5-1.7 for body text",
    fix: `p, li, blockquote {
  line-height: 1.6;
}`,
  });

  // 4. Font Size
  const fontSizeCheck = checkFontSize(container);
  const fontSizeScore = Math.max(0, 100 - fontSizeCheck.violations.length * 20);
  checks.push({
    id: "font-size",
    name: "Font Size",
    score: fontSizeScore,
    status: fontSizeScore >= 80 ? "pass" : fontSizeScore >= 50 ? "warn" : "fail",
    findings: fontSizeCheck.violations.length === 0
      ? ["All text meets WCAG minimum size"]
      : fontSizeCheck.violations.slice(0, 3),
    recommendation: "Use minimum 16px for body text (WCAG compliance)",
    fix: `body {
  font-size: 16px;
}

@media (min-width: 768px) {
  body {
    font-size: 18px;
  }
}`,
  });

  // 5. Heading Hierarchy
  const hierarchyCheck = checkHeadingHierarchy(container);
  const hierarchyScore = Math.max(0, 100 - hierarchyCheck.violations.length * 20);
  checks.push({
    id: "heading-hierarchy",
    name: "Heading Hierarchy",
    score: hierarchyScore,
    status: hierarchyScore >= 80 ? "pass" : hierarchyScore >= 50 ? "warn" : "fail",
    findings: hierarchyCheck.violations.length === 0
      ? ["Heading hierarchy is correct"]
      : hierarchyCheck.violations,
    recommendation: "Follow proper heading order (h1→h2→h3) without skipping levels",
    fix: "Ensure headings follow sequential order: h1 → h2 → h3, etc.",
  });

  // 6. Short Word Stranding
  const strandingCheck = checkShortWordStranding(container);
  const strandingScore = Math.max(0, 100 - strandingCheck.count * 8);
  checks.push({
    id: "short-word-stranding",
    name: "Short Word Stranding",
    score: strandingScore,
    status: strandingScore >= 80 ? "pass" : strandingScore >= 50 ? "warn" : "fail",
    findings: strandingCheck.count === 0
      ? ["No short words stranded at line ends"]
      : [`Found ${strandingCheck.count} potential stranding issue(s)`, ...strandingCheck.examples.slice(0, 3)],
    recommendation: "Use non-breaking spaces (&nbsp;) to bind short words to the next word",
    fix: `// JavaScript example
text = text.replace(/\\s+(a|an|the|in|on|at|to|by|of)\\s+/gi,
  (match) => '&nbsp;' + match.trim() + '&nbsp;');`,
  });

  // 7. Widows (simplified check)
  checks.push({
    id: "widows",
    name: "Widows",
    score: 75,
    status: "warn",
    findings: ["Widow detection requires pagination context"],
    recommendation: "Use CSS widows property for multi-column or print layouts",
    fix: `p {
  widows: 2;
  orphans: 2;
}`,
  });

  // 8. Font Loading
  checks.push({
    id: "font-loading",
    name: "Font Loading",
    score: 80,
    status: "pass",
    findings: ["Font loading strategy cannot be detected from HTML alone"],
    recommendation: "Use font-display: swap or optional in @font-face rules",
    fix: `@font-face {
  font-family: 'YourFont';
  src: url('/fonts/yourfont.woff2') format('woff2');
  font-display: swap;
}`,
  });

  // 9. Vertical Rhythm
  const rhythmCheck = checkVerticalRhythm(container);
  const rhythmScore = rhythmCheck.consistent ? 100 : 60;
  checks.push({
    id: "vertical-rhythm",
    name: "Vertical Rhythm",
    score: rhythmScore,
    status: rhythmScore >= 80 ? "pass" : "warn",
    findings: rhythmCheck.findings,
    recommendation: "Use consistent spacing based on a base unit (e.g., 8px or 16px)",
    fix: `/* Use spacing scale */
:root {
  --space-1: 0.25rem; /* 4px */
  --space-2: 0.5rem;  /* 8px */
  --space-3: 1rem;    /* 16px */
  --space-4: 1.5rem;  /* 24px */
  --space-5: 2rem;    /* 32px */
}

h1 { margin-bottom: var(--space-4); }
h2 { margin-bottom: var(--space-3); }
p { margin-bottom: var(--space-3); }`,
  });

  // 10. OpenType Features
  const otCheck = checkOpenTypeFeatures(container);
  const otScore = otCheck.missing.length === 0 ? 100 : 50;
  checks.push({
    id: "opentype",
    name: "OpenType Features",
    score: otScore,
    status: otScore >= 80 ? "pass" : "warn",
    findings: otCheck.missing.length === 0
      ? ["OpenType features are enabled"]
      : otCheck.missing,
    recommendation: "Enable ligatures and kerning for better typography",
    fix: `body {
  font-feature-settings: "kern" 1, "liga" 1, "calt" 1;
}`,
  });

  // 11. Contrast Ratio
  const contrastCheck = checkContrast(container);
  const contrastScore = Math.max(0, 100 - contrastCheck.violations.length * 15);
  checks.push({
    id: "contrast",
    name: "Contrast Ratio",
    score: contrastScore,
    status: contrastScore >= 80 ? "pass" : contrastScore >= 50 ? "warn" : "fail",
    findings: contrastCheck.violations.length === 0
      ? ["All text meets WCAG AA contrast requirements"]
      : contrastCheck.violations.slice(0, 3),
    recommendation: "Ensure text has minimum 4.5:1 contrast ratio (WCAG AA)",
    fix: `/* Use sufficient contrast */
body {
  color: #e5e5e5;
  background: #0a0a0a;
}

/* Contrast ratio: 17.9:1 ✓ */`,
  });

  // 12. Text Wrap Usage
  const wrapCheck = checkTextWrap(container);
  const wrapScore = Math.max(0, 100 - wrapCheck.missing.length * 10);
  checks.push({
    id: "text-wrap",
    name: "text-wrap Usage",
    score: wrapScore,
    status: wrapScore >= 80 ? "pass" : wrapScore >= 50 ? "warn" : "fail",
    findings: wrapCheck.missing.length === 0
      ? ["text-wrap is properly applied"]
      : [`${wrapCheck.missing.length} element(s) missing text-wrap`, ...wrapCheck.missing.slice(0, 3)],
    recommendation: "Use text-wrap: balance for headings, text-wrap: pretty for body text",
    fix: `h1, h2, h3, h4, h5, h6 {
  text-wrap: balance;
}

p, li, blockquote {
  text-wrap: pretty;
}`,
  });

  // Clean up
  document.body.removeChild(container);

  // Calculate overall score
  const overallScore = Math.round(
    checks.reduce((sum, check) => sum + check.score, 0) / checks.length
  );

  return { overallScore, checks };
}

/* ── Component ── */
export default function TypographicAudit() {
  const [input, setInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [inputMode, setInputMode] = useState<"html" | "url">("url");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAnalyze = async () => {
    setFetchError("");

    if (inputMode === "url") {
      const url = urlInput.trim();
      if (!url) return;
      setAnalyzing(true);
      try {
        const normalizedUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;
        const res = await fetch(`/api/fetch-url?url=${encodeURIComponent(normalizedUrl)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to fetch (${res.status})`);
        }
        const { html } = await res.json();
        const auditResult = performAudit(html);
        setResult(auditResult);
      } catch (err: any) {
        setFetchError(err.message || "Failed to fetch URL");
        setResult(null);
      } finally {
        setAnalyzing(false);
      }
    } else {
      if (!input.trim()) return;
      setAnalyzing(true);
      setTimeout(() => {
        const auditResult = performAudit(input);
        setResult(auditResult);
        setAnalyzing(false);
      }, 300);
    }
  };

  const loadSample = () => {
    setInput(SAMPLE_HTML);
    setResult(null);
  };

  const exportJSON = () => {
    if (!result) return;
    const json = JSON.stringify(result, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "typography-audit.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const scoreColor = useMemo(() => {
    if (!result) return "#B8963E";
    if (result.overallScore >= 80) return "#4ade80";
    if (result.overallScore >= 50) return "#fbbf24";
    return "#f87171";
  }, [result]);

  const statusIcon = (status: "pass" | "warn" | "fail") => {
    if (status === "pass") return "✓";
    if (status === "warn") return "!";
    return "✕";
  };

  const statusColor = (status: "pass" | "warn" | "fail") => {
    if (status === "pass") return "text-green-400";
    if (status === "warn") return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* Header */}
      <section className="border-b border-neutral-800 px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E]">
              08 -- Typographic Audit
            </p>
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mt-2"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Typographic Audit
            </h1>
            <p
              className="text-neutral-400 mt-2 leading-relaxed text-sm sm:text-base"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              Score your typography quality — like Lighthouse, but for type
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
        {/* Input Section */}
        <section className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-0 border border-neutral-800 w-fit">
            <button
              onClick={() => setInputMode("url")}
              className={`px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                inputMode === "url"
                  ? "bg-[#B8963E]/10 text-[#B8963E] border-r border-neutral-800"
                  : "text-neutral-500 hover:text-neutral-300 border-r border-neutral-800"
              }`}
            >
              Website URL
            </button>
            <button
              onClick={() => setInputMode("html")}
              className={`px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                inputMode === "html"
                  ? "bg-[#B8963E]/10 text-[#B8963E]"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Paste HTML
            </button>
          </div>

          <div className="border border-neutral-800 bg-neutral-950/50">
            {inputMode === "url" ? (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                  <span className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-500">
                    Website Address
                  </span>
                </div>
                <div className="p-4 sm:p-6">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                    placeholder="apple.com"
                    className="w-full bg-transparent text-neutral-200 font-mono text-sm sm:text-base outline-none placeholder:text-neutral-600"
                    style={{ fontFamily: "var(--font-mono)" }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                  <span className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-500">
                    HTML or Text Input
                  </span>
                  <button
                    onClick={loadSample}
                    className="text-xs font-mono uppercase tracking-wider text-neutral-500 hover:text-[#B8963E] transition-colors"
                  >
                    Load Example
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Paste your HTML markup or plain text here..."
                  className="w-full bg-transparent text-neutral-200 p-4 sm:p-6 font-mono text-xs sm:text-sm resize-none outline-none min-h-[240px]"
                  style={{ fontFamily: "var(--font-mono)" }}
                />
              </>
            )}
          </div>

          {fetchError && (
            <p className="text-red-400 text-sm font-mono">{fetchError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleAnalyze}
              disabled={(inputMode === "url" ? !urlInput.trim() : !input.trim()) || analyzing}
              className="flex-1 px-6 py-3 border border-[#B8963E] text-[#B8963E] font-mono text-sm uppercase tracking-wider hover:bg-[#B8963E] hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? "Fetching & Analyzing..." : "Analyze"}
            </button>
          </div>
        </section>

        {/* Results */}
        {result && (
          <div className="mt-12 space-y-8">
            {/* Overall Score */}
            <section className="border border-neutral-800 bg-neutral-950/50 p-8 text-center">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-500 mb-4">
                Overall Typography Score
              </p>
              <div className="relative inline-flex items-center justify-center">
                <svg width="200" height="200" className="transform -rotate-90">
                  <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="none"
                    stroke="#262626"
                    strokeWidth="12"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="none"
                    stroke={scoreColor}
                    strokeWidth="12"
                    strokeDasharray={`${(result.overallScore / 100) * 534} 534`}
                    strokeLinecap="square"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-6xl font-bold"
                    style={{ color: scoreColor, fontFamily: "var(--font-playfair)" }}
                  >
                    {result.overallScore}
                  </span>
                </div>
              </div>
              <button
                onClick={exportJSON}
                className="mt-6 px-4 py-2 text-xs font-mono uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors"
              >
                Export as JSON
              </button>
            </section>

            {/* Individual Checks */}
            <section className="space-y-4">
              <h2
                className="text-2xl font-bold tracking-tight"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Detailed Results
              </h2>
              <div className="grid gap-4">
                {result.checks.map((check) => (
                  <div
                    key={check.id}
                    className="border border-neutral-800 bg-neutral-950/50"
                  >
                    <div className="flex items-start justify-between p-4 border-b border-neutral-800">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-2xl font-bold ${statusColor(check.status)}`}
                          >
                            {statusIcon(check.status)}
                          </span>
                          <div>
                            <h3
                              className="text-lg font-bold"
                              style={{ fontFamily: "var(--font-playfair)" }}
                            >
                              {check.name}
                            </h3>
                            <p className="text-xs text-neutral-500 mt-1">
                              {check.recommendation}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold" style={{ color: scoreColor }}>
                          {check.score}
                        </p>
                        <p className="text-xs text-neutral-600">/ 100</p>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Findings */}
                      <div>
                        <p className="font-mono text-xs uppercase tracking-widest text-neutral-600 mb-2">
                          Findings
                        </p>
                        <ul className="space-y-1">
                          {check.findings.map((finding, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-neutral-400 font-mono"
                            >
                              • {finding}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Fix Code */}
                      {check.fix && (
                        <div>
                          <p className="font-mono text-xs uppercase tracking-widest text-neutral-600 mb-2">
                            How to Fix
                          </p>
                          <CodeBlock code={check.fix} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-800 py-12 text-center mt-16">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">
          Built with care for the craft of typography
        </p>
      </footer>
    </main>
  );
}
