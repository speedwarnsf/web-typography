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

/**
 * Detect actual rendered orphans using Range API.
 * An orphan = a single short word sitting alone on the last rendered line.
 */
function countOrphans(container: HTMLElement): { count: number; elements: string[] } {
  const paragraphs = container.querySelectorAll("p");
  const orphans: string[] = [];
  let count = 0;

  paragraphs.forEach((p, idx) => {
    const text = p.textContent?.trim() || "";
    if (text.length < 20) return; // Skip very short paragraphs

    try {
      // Use Range API to find the last line's content
      const textNode = getLastTextNode(p);
      if (!textNode || !textNode.textContent) return;

      const range = document.createRange();
      range.selectNodeContents(p);
      const allRects = range.getClientRects();
      if (allRects.length < 2) return; // Single line, no orphan possible

      const lastRect = allRects[allRects.length - 1];
      const secondLastRect = allRects[allRects.length - 2];

      // If the last line is significantly shorter than previous lines,
      // check if it contains only a short word
      if (lastRect.width < secondLastRect.width * 0.25) {
        // Find what text is on the last line by walking backwards
        const words = text.split(/\s+/);
        const lastWord = words[words.length - 1];
        if (lastWord && lastWord.length <= 6 && words.length > 3) {
          count++;
          orphans.push(`Paragraph ${idx + 1}: "${text.slice(0, 50)}..."`);
        }
      }
    } catch {
      // Fallback: skip if Range API fails
    }
  });

  return { count, elements: orphans };
}

function getLastTextNode(el: Node): Text | null {
  if (el.nodeType === Node.TEXT_NODE) return el as Text;
  for (let i = el.childNodes.length - 1; i >= 0; i--) {
    const found = getLastTextNode(el.childNodes[i]);
    if (found) return found;
  }
  return null;
}

/**
 * Check rendered line length using element width and font metrics.
 * Measures actual rendered width, not raw character count.
 */
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
    if (text.length === 0) return;

    const computed = window.getComputedStyle(p);
    const fontSize = parseFloat(computed.fontSize);
    const renderedWidth = p.getBoundingClientRect().width;

    // Approximate characters per line based on rendered width and font size
    // Average character width ≈ 0.5em for proportional fonts, 0.6em for monospace
    const isMonospace = computed.fontFamily.toLowerCase().includes("mono");
    const avgCharWidth = fontSize * (isMonospace ? 0.6 : 0.5);
    const charsPerLine = Math.round(renderedWidth / avgCharWidth);

    if (charsPerLine < 30) {
      distribution.short++;
      // Only flag if it's body text with enough content to matter
      if (text.length > 80) {
        violations++;
        problematic.push(`Paragraph ${idx + 1}: ~${charsPerLine} chars/line (too narrow)`);
      }
    } else if (charsPerLine > 85) {
      distribution.long++;
      violations++;
      problematic.push(`Paragraph ${idx + 1}: ~${charsPerLine} chars/line (too wide)`);
    } else {
      distribution.optimal++;
    }
  });

  return { violations, distribution, elements: problematic };
}

/**
 * Check line-height ratios. Skip labels and very short text.
 */
function checkLineHeight(container: HTMLElement): { violations: string[]; avgLineHeight: number } {
  const elements = container.querySelectorAll("p, li, blockquote");
  const violations: string[] = [];
  let totalLineHeight = 0;
  let count = 0;

  elements.forEach((el, idx) => {
    // Skip very short text (labels, captions)
    const text = el.textContent?.trim() || "";
    if (text.length < 20) return;

    const computed = window.getComputedStyle(el);
    const lineHeight = parseFloat(computed.lineHeight);
    const fontSize = parseFloat(computed.fontSize);
    const ratio = lineHeight / fontSize;

    if (!isNaN(ratio)) {
      totalLineHeight += ratio;
      count++;

      if (ratio < 1.4 || ratio > 1.8) {
        violations.push(
          `Element ${idx + 1}: line-height ratio ${ratio.toFixed(2)} (optimal: 1.4\u20131.8)`
        );
      }
    }
  });

  return {
    violations,
    avgLineHeight: count > 0 ? totalLineHeight / count : 0,
  };
}

/**
 * Check font sizes. Only flag body copy elements, not UI chrome or labels.
 */
function checkFontSize(container: HTMLElement): { violations: string[] } {
  // Only check body copy elements — not spans, divs, labels, or UI chrome
  const textElements = container.querySelectorAll("p, li, blockquote");
  const violations: string[] = [];

  textElements.forEach((el, idx) => {
    const text = el.textContent?.trim() || "";
    if (text.length < 15) return; // Skip very short elements (labels)

    const computed = window.getComputedStyle(el);
    const fontSize = parseFloat(computed.fontSize);

    if (fontSize < 16) {
      violations.push(`Element ${idx + 1}: ${fontSize}px (minimum: 16px for body text)`);
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
  const paragraphs = container.querySelectorAll("p");
  let count = 0;
  const examples: string[] = [];

  paragraphs.forEach((p, idx) => {
    const text = p.textContent?.trim() || "";
    const words = text.split(/\s+/);
    const lastWord = words[words.length - 1]?.toLowerCase();

    if (
      lastWord &&
      ["a", "an", "the", "in", "on", "at", "to", "by", "of", "or", "and", "but", "for", "nor", "yet", "so"].includes(
        lastWord
      )
    ) {
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
    const tw = computed.textWrap || "";
    if (!tw.includes("balance")) {
      missing.push(`${h.tagName} ${idx + 1}: missing text-wrap: balance`);
    }
  });

  paragraphs.forEach((p, idx) => {
    const computed = window.getComputedStyle(p);
    const tw = computed.textWrap || "";
    if (!tw.includes("pretty") && !tw.includes("balance")) {
      missing.push(`Paragraph ${idx + 1}: missing text-wrap: pretty`);
    }
  });

  return { missing };
}

/**
 * Resolve the effective background color by walking up the DOM tree.
 * Handles transparent/rgba(0,0,0,0) backgrounds properly.
 */
function getEffectiveBackground(el: Element): number[] | null {
  let current: Element | null = el;

  while (current) {
    const computed = window.getComputedStyle(current);
    const bg = computed.backgroundColor;
    const parsed = parseRGBA(bg);

    if (parsed && parsed[3] > 0.01) {
      return [parsed[0], parsed[1], parsed[2]];
    }

    current = current.parentElement;
  }

  // No opaque background found — assume page background
  // Check if the page is dark or light themed
  const bodyBg = parseRGBA(window.getComputedStyle(document.body).backgroundColor);
  if (bodyBg && bodyBg[3] > 0.01) {
    return [bodyBg[0], bodyBg[1], bodyBg[2]];
  }

  // Default: white background
  return [255, 255, 255];
}

function parseRGBA(str: string): number[] | null {
  const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;
  return [
    parseInt(match[1]),
    parseInt(match[2]),
    parseInt(match[3]),
    match[4] !== undefined ? parseFloat(match[4]) : 1,
  ];
}

function checkContrast(container: HTMLElement): { violations: string[] } {
  // Only check meaningful text elements
  const textElements = container.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li");
  const violations: string[] = [];

  textElements.forEach((el, idx) => {
    const text = el.textContent?.trim() || "";
    if (text.length < 2) return;

    const computed = window.getComputedStyle(el);
    const fg = parseRGBA(computed.color);
    const bg = getEffectiveBackground(el);

    if (!fg || !bg) return;

    const getLuminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => {
        v = v / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const l1 = getLuminance([fg[0], fg[1], fg[2]]);
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
    if (marginTop > 0) margins.add(Math.round(marginTop));
    if (marginBottom > 0) margins.add(Math.round(marginBottom));
  });

  const marginArray = Array.from(margins).sort((a, b) => a - b);

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
      findings.push("Margins don\u2019t follow a consistent vertical rhythm");
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

  elements.forEach(() => {
    // Also check body-level features
  });

  // Check body and first few elements for font-feature-settings
  const bodyFeatures = window.getComputedStyle(container).fontFeatureSettings;
  if (bodyFeatures !== "normal" && bodyFeatures !== '""') {
    hasFeatures = true;
  }

  if (!hasFeatures) {
    elements.forEach((el) => {
      const computed = window.getComputedStyle(el);
      const features = computed.fontFeatureSettings;
      if (features !== "normal" && features !== '""') {
        hasFeatures = true;
      }
    });
  }

  if (!hasFeatures) {
    missing.push("No font-feature-settings detected. Consider enabling ligatures and kerning.");
  }

  return { missing };
}

/* ── Main Audit Function ── */
function performAudit(html: string): AuditResult {
  const container = document.createElement("div");
  container.innerHTML = html;
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.width = "600px";
  container.style.fontSize = "16px";
  container.style.lineHeight = "1.6";
  document.body.appendChild(container);

  // Let styles compute
  const checks: AuditCheck[] = [];

  // 1. Orphans — real rendered orphan detection
  const orphanCheck = countOrphans(container);
  const orphanScore = orphanCheck.count === 0 ? 100 : Math.max(0, 100 - orphanCheck.count * 15);
  checks.push({
    id: "orphans",
    name: "Orphans",
    score: orphanScore,
    status: orphanScore >= 80 ? "pass" : orphanScore >= 50 ? "warn" : "fail",
    findings:
      orphanCheck.count === 0
        ? ["No orphans detected"]
        : [`Found ${orphanCheck.count} potential orphan(s)`, ...orphanCheck.elements.slice(0, 3)],
    recommendation: "Use text-wrap: balance on headings and text-wrap: pretty on paragraphs",
    fix: `h1, h2, h3, h4, h5, h6 {\n  text-wrap: balance;\n}\n\np {\n  text-wrap: pretty;\n}`,
  });

  // 2. Line Length — rendered width measurement
  const lineLengthCheck = checkLineLength(container);
  const totalParas =
    lineLengthCheck.distribution.short + lineLengthCheck.distribution.optimal + lineLengthCheck.distribution.long;
  const optimalPct = totalParas > 0 ? lineLengthCheck.distribution.optimal / totalParas : 1;
  const lineLengthScore = Math.round(optimalPct * 100);
  checks.push({
    id: "line-length",
    name: "Line Length",
    score: lineLengthScore,
    status: lineLengthScore >= 80 ? "pass" : lineLengthScore >= 50 ? "warn" : "fail",
    findings: [
      `Narrow: ${lineLengthCheck.distribution.short}, Optimal: ${lineLengthCheck.distribution.optimal}, Wide: ${lineLengthCheck.distribution.long}`,
      ...lineLengthCheck.elements.slice(0, 3),
    ],
    recommendation: "Keep line length between 45\u201375 characters for optimal readability",
    fix: `p {\n  max-width: 65ch;\n}`,
  });

  // 3. Line Height
  const lineHeightCheck = checkLineHeight(container);
  const lineHeightScore = Math.max(0, 100 - lineHeightCheck.violations.length * 15);
  checks.push({
    id: "line-height",
    name: "Line Height",
    score: lineHeightScore,
    status: lineHeightScore >= 80 ? "pass" : lineHeightScore >= 50 ? "warn" : "fail",
    findings:
      lineHeightCheck.violations.length === 0
        ? [`Average line-height: ${lineHeightCheck.avgLineHeight.toFixed(2)} \u2014 Good`]
        : lineHeightCheck.violations.slice(0, 3),
    recommendation: "Use line-height between 1.4\u20131.8 for body text",
    fix: `p, li, blockquote {\n  line-height: 1.6;\n}`,
  });

  // 4. Font Size — body copy only
  const fontSizeCheck = checkFontSize(container);
  const fontSizeScore = Math.max(0, 100 - fontSizeCheck.violations.length * 20);
  checks.push({
    id: "font-size",
    name: "Font Size",
    score: fontSizeScore,
    status: fontSizeScore >= 80 ? "pass" : fontSizeScore >= 50 ? "warn" : "fail",
    findings:
      fontSizeCheck.violations.length === 0
        ? ["All body text meets minimum size (16px)"]
        : fontSizeCheck.violations.slice(0, 3),
    recommendation: "Use minimum 16px for body text (WCAG compliance)",
    fix: `body {\n  font-size: 16px;\n}\n\n@media (min-width: 768px) {\n  body {\n    font-size: 18px;\n  }\n}`,
  });

  // 5. Heading Hierarchy
  const hierarchyCheck = checkHeadingHierarchy(container);
  const hierarchyScore = Math.max(0, 100 - hierarchyCheck.violations.length * 20);
  checks.push({
    id: "heading-hierarchy",
    name: "Heading Hierarchy",
    score: hierarchyScore,
    status: hierarchyScore >= 80 ? "pass" : hierarchyScore >= 50 ? "warn" : "fail",
    findings:
      hierarchyCheck.violations.length === 0 ? ["Heading hierarchy is correct"] : hierarchyCheck.violations,
    recommendation: "Follow proper heading order (h1\u2192h2\u2192h3) without skipping levels",
    fix: "Ensure headings follow sequential order: h1 \u2192 h2 \u2192 h3, etc.",
  });

  // 6. Short Word Stranding
  const strandingCheck = checkShortWordStranding(container);
  const strandingScore = Math.max(0, 100 - strandingCheck.count * 8);
  checks.push({
    id: "short-word-stranding",
    name: "Short Word Stranding",
    score: strandingScore,
    status: strandingScore >= 80 ? "pass" : strandingScore >= 50 ? "warn" : "fail",
    findings:
      strandingCheck.count === 0
        ? ["No short words stranded at line ends"]
        : [`Found ${strandingCheck.count} potential stranding issue(s)`, ...strandingCheck.examples.slice(0, 3)],
    recommendation: "Use non-breaking spaces (&nbsp;) to bind short words to the next word",
    fix: `// JavaScript example\ntext = text.replace(/\\s+(a|an|the|in|on|at|to|by|of)\\s+/gi,\n  (match) => '\u00a0' + match.trim() + ' ');`,
  });

  // 7. Widows
  checks.push({
    id: "widows",
    name: "Widows",
    score: 75,
    status: "warn",
    findings: ["Widow detection requires pagination context"],
    recommendation: "Use CSS widows property for multi-column or print layouts",
    fix: `p {\n  widows: 2;\n  orphans: 2;\n}`,
  });

  // 8. Font Loading
  checks.push({
    id: "font-loading",
    name: "Font Loading",
    score: 80,
    status: "pass",
    findings: ["Font loading strategy cannot be fully detected from HTML alone"],
    recommendation: "Use font-display: swap or optional in @font-face rules",
    fix: `@font-face {\n  font-family: 'YourFont';\n  src: url('/fonts/yourfont.woff2') format('woff2');\n  font-display: swap;\n}`,
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
    fix: `/* Use spacing scale */\n:root {\n  --space-1: 0.25rem; /* 4px */\n  --space-2: 0.5rem;  /* 8px */\n  --space-3: 1rem;    /* 16px */\n  --space-4: 1.5rem;  /* 24px */\n  --space-5: 2rem;    /* 32px */\n}\n\nh1 { margin-bottom: var(--space-4); }\nh2 { margin-bottom: var(--space-3); }\np { margin-bottom: var(--space-3); }`,
  });

  // 10. OpenType Features
  const otCheck = checkOpenTypeFeatures(container);
  const otScore = otCheck.missing.length === 0 ? 100 : 50;
  checks.push({
    id: "opentype",
    name: "OpenType Features",
    score: otScore,
    status: otScore >= 80 ? "pass" : "warn",
    findings: otCheck.missing.length === 0 ? ["OpenType features are enabled"] : otCheck.missing,
    recommendation: "Enable ligatures and kerning for better typography",
    fix: `body {\n  font-feature-settings: "kern" 1, "liga" 1, "calt" 1;\n}`,
  });

  // 11. Contrast — with proper background resolution
  const contrastCheck = checkContrast(container);
  const contrastScore = Math.max(0, 100 - contrastCheck.violations.length * 15);
  checks.push({
    id: "contrast",
    name: "Contrast Ratio",
    score: contrastScore,
    status: contrastScore >= 80 ? "pass" : contrastScore >= 50 ? "warn" : "fail",
    findings:
      contrastCheck.violations.length === 0
        ? ["All text meets WCAG AA contrast requirements"]
        : contrastCheck.violations.slice(0, 3),
    recommendation: "Ensure text has minimum 4.5:1 contrast ratio (WCAG AA)",
    fix: `/* Use sufficient contrast */\nbody {\n  color: #e5e5e5;\n  background: #0a0a0a;\n}\n\n/* Contrast ratio: 17.9:1 \u2713 */`,
  });

  // 12. Text Wrap Usage
  const wrapCheck = checkTextWrap(container);
  const wrapScore = Math.max(0, 100 - wrapCheck.missing.length * 10);
  checks.push({
    id: "text-wrap",
    name: "text-wrap Usage",
    score: wrapScore,
    status: wrapScore >= 80 ? "pass" : wrapScore >= 50 ? "warn" : "fail",
    findings:
      wrapCheck.missing.length === 0
        ? ["text-wrap is properly applied"]
        : [`${wrapCheck.missing.length} element(s) missing text-wrap`, ...wrapCheck.missing.slice(0, 3)],
    recommendation: "Use text-wrap: balance for headings, text-wrap: pretty for body text",
    fix: `h1, h2, h3, h4, h5, h6 {\n  text-wrap: balance;\n}\n\np, li, blockquote {\n  text-wrap: pretty;\n}`,
  });

  // Clean up
  document.body.removeChild(container);

  // Calculate overall score
  const overallScore = Math.round(checks.reduce((sum, check) => sum + check.score, 0) / checks.length);

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
      } catch (err: unknown) {
        setFetchError(err instanceof Error ? err.message : "Failed to fetch URL");
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
    if (status === "pass") return "\u2713";
    if (status === "warn") return "!";
    return "\u2715";
  };

  const statusColor = (status: "pass" | "warn" | "fail") => {
    if (status === "pass") return "text-green-400";
    if (status === "warn") return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* Header */}
      <section className="border-b border-neutral-800 px-4 py-6 sm:px-6 sm:py-8">
        <div className="max-w-5xl mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E]">
              08 -- Typographic Audit
            </p>
            <h1
              className="text-3xl font-bold tracking-tight mt-2 sm:text-4xl md:text-5xl"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Typographic Audit
            </h1>
            <p
              className="text-neutral-400 mt-2 leading-relaxed text-sm sm:text-base"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              Score your typography quality \u2014 like Lighthouse, but for type
            </p>
          </div>
          <a
            href="/"
            className="px-4 py-2 text-xs font-mono uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors w-full text-center sm:w-auto shrink-0"
          >
            Back
          </a>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
        {/* Input Section */}
        <section className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-0 border border-neutral-800 w-fit">
            <button
              onClick={() => setInputMode("url")}
              className={`px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors sm:px-4 ${
                inputMode === "url"
                  ? "bg-[#B8963E]/10 text-[#B8963E] border-r border-neutral-800"
                  : "text-neutral-500 hover:text-neutral-300 border-r border-neutral-800"
              }`}
            >
              Website URL
            </button>
            <button
              onClick={() => setInputMode("html")}
              className={`px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors sm:px-4 ${
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
                    className="w-full bg-transparent text-neutral-200 font-mono text-sm outline-none placeholder:text-neutral-600 sm:text-base"
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
                  className="w-full bg-transparent text-neutral-200 p-4 font-mono text-xs resize-none outline-none min-h-[200px] sm:p-6 sm:text-sm sm:min-h-[240px]"
                  style={{ fontFamily: "var(--font-mono)" }}
                />
              </>
            )}
          </div>

          {fetchError && <p className="text-red-400 text-sm font-mono">{fetchError}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleAnalyze}
              disabled={(inputMode === "url" ? !urlInput.trim() : !input.trim()) || analyzing}
              className="flex-1 px-4 py-3 border border-[#B8963E] text-[#B8963E] font-mono text-sm uppercase tracking-wider hover:bg-[#B8963E] hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed sm:px-6"
            >
              {analyzing ? "Fetching & Analyzing\u2026" : "Analyze"}
            </button>
          </div>
        </section>

        {/* Results */}
        {result && (
          <div className="mt-8 space-y-6 sm:mt-12 sm:space-y-8">
            {/* Overall Score */}
            <section className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6 text-center sm:p-8">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-500 mb-4">
                Overall Typography Score
              </p>
              <div className="relative inline-flex items-center justify-center">
                <svg width="160" height="160" className="transform -rotate-90 sm:w-[200px] sm:h-[200px]">
                  <circle
                    cx="80"
                    cy="80"
                    r="68"
                    fill="none"
                    stroke="#262626"
                    strokeWidth="10"
                    className="sm:hidden"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="68"
                    fill="none"
                    stroke={scoreColor}
                    strokeWidth="10"
                    strokeDasharray={`${(result.overallScore / 100) * 427} 427`}
                    strokeLinecap="square"
                    className="transition-all duration-1000 sm:hidden"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="none"
                    stroke="#262626"
                    strokeWidth="12"
                    className="hidden sm:block"
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
                    className="transition-all duration-1000 hidden sm:block"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-5xl font-bold sm:text-6xl"
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
                className="text-xl font-bold tracking-tight sm:text-2xl"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Detailed Results
              </h2>
              <div className="grid gap-4">
                {result.checks.map((check) => (
                  <div key={check.id} className="border border-neutral-800 bg-neutral-950/50">
                    <div className="flex items-start justify-between p-4 border-b border-neutral-800 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className={`text-xl font-bold shrink-0 sm:text-2xl ${statusColor(check.status)}`}>
                            {statusIcon(check.status)}
                          </span>
                          <div className="min-w-0">
                            <h3
                              className="text-base font-bold sm:text-lg"
                              style={{ fontFamily: "var(--font-playfair)" }}
                            >
                              {check.name}
                            </h3>
                            <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{check.recommendation}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold sm:text-2xl" style={{ color: scoreColor }}>
                          {check.score}
                        </p>
                        <p className="text-xs text-neutral-600">/ 100</p>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-widest text-neutral-600 mb-2">Findings</p>
                        <ul className="space-y-1">
                          {check.findings.map((finding, fidx) => (
                            <li key={fidx} className="text-xs text-neutral-400 font-mono break-words sm:text-sm">
                              \u2022 {finding}
                            </li>
                          ))}
                        </ul>
                      </div>

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
      <footer className="border-t border-neutral-800 py-8 text-center mt-12 sm:py-12 sm:mt-16">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">
          Built with care for the craft of typography
        </p>
      </footer>
    </main>
  );
}
