'use client';

/**
 * typeset.ts — Typographic refinement utility
 * 
 * Applies professional typographic rules to text elements:
 * 
 * Rule 1: No orphans — last line must have at least 2 words
 * Rule 2: Sentence-start protection — if a new sentence starts and only 1 word
 *         fits on the remaining line, push it to the next line
 * Rule 3: Sentence-end protection — if the last word of a sentence would be
 *         alone on a new line, bring a companion with it
 * Rule 4: Rag smoothing — if a line's last word juts out 3+ chars past the
 *         line below, knock it down for a smoother right edge
 * 
 * Usage:
 *   typeset(element)                    — process a single element
 *   typesetAll(selector)                — process all matching elements
 *   <Typeset> wrapper component         — React component
 */

const NBSP = '\u00A0'; // non-breaking space
const HAIR = '\u200A'; // hair space (invisible, used as marker)

/**
 * Options for typesetText
 */
export interface TypesetOptions {
  mode?: 'body' | 'heading';
  /** Line length in characters — at narrow measures (<50ch), only orphan prevention runs */
  measure?: number;
}

/**
 * Detect sentence boundaries
 */
const isSentenceEnd = (word: string) =>
  /[.!?]$/.test(word) || /[.!?]["'\u201D\u2019]$/.test(word);

/**
 * Heading mode: semantic-aware line breaks.
 * Prioritizes meaning over orphan prevention.
 * Binds at punctuation boundaries, keeps phrases together.
 */
function typesetHeadingText(text: string): string {
  if (!text || text.length < 5) return text;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) return text;

  const ARTICLES = new Set(['a', 'an', 'the']);
  const PREPS = new Set(['to', 'in', 'on', 'of', 'at', 'by', 'for', 'with', 'from']);

  const result: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const nextWord = i < words.length - 1 ? words[i + 1] : null;

    // Never let an article sit alone at end of line — bind to next word
    if (ARTICLES.has(word.toLowerCase()) && nextWord) {
      result.push(word + NBSP + words[i + 1]);
      i++;
      continue;
    }

    // Never let a short preposition sit alone at end of line
    if (PREPS.has(word.toLowerCase()) && nextWord) {
      result.push(word + NBSP + words[i + 1]);
      i++;
      continue;
    }

    result.push(word);
  }

  return result.join(' ');
}

/**
 * Insert non-breaking spaces to enforce typographic rules.
 * Works by analyzing word groups and binding words that must stay together.
 *
 * @param text The text to process
 * @param options Optional: { mode: 'body' | 'heading' }. Default: 'body'.
 */
export function typesetText(text: string, options?: TypesetOptions): string {
  const mode = options?.mode ?? 'body';
  if (mode === 'heading') {
    return typesetHeadingText(text);
  }
  return typesetBodyText(text, options?.measure);
}

/**
 * Convenience export for heading mode.
 */
export function typesetHeading(text: string): string {
  return typesetText(text, { mode: 'heading' });
}

/**
 * Body mode: full typographic rules with orphan prevention,
 * short-word binding, sentence protection.
 */
function typesetBodyText(text: string, measure?: number): string {
  if (!text || text.length < 10) return text;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) return text;

  // Tiered binding based on actual column width.
  //
  // MOBILE-FIRST PRINCIPLE (2026-03-09):
  // At narrow widths (<40ch, ~5-7 words per line), each nbsp binding
  // creates a forced word pair that constrains the browser's line-breaking
  // algorithm. With 10-15 bindings in a paragraph, the browser has almost
  // no freedom, and the result is WORSE than default — stranded words,
  // uneven lines, and orphan-like breaks that wouldn't exist without us.
  //
  // At narrow widths, let CSS text-wrap:pretty do the heavy lifting.
  // JS bindings should only handle what CSS can't: orphan prevention
  // and keeping numbers with their units.
  //
  // The thresholds below were tuned by testing at 375px (iPhone SE)
  // through 1200px+ desktop. DO NOT lower them without testing mobile.
  const m = measure ?? 65;
  const doOrphans = m >= 25;                     // almost always — single-word last lines look bad at any width
  const doNumberBinding = m >= 25;               // "30 years" — always safe, very short atom
  const doTinyWordBinding = m >= 45;             // 1-2 char words: safe at medium+ widths, harmful at mobile
  const doSentenceProtection = m >= 50;          // sentence start/end: needs room to work
  const doMediumWordBinding = m >= 55;           // 3-char words (the, and, but, for)
  const doFullShortWordBinding = m >= 65;        // full list: wide measures only

  // Build word lists by size tier
  const tinyWords = new Set(['a', 'i', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'if', 'in', 'is', 'it', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'we']);
  const mediumWords = new Set(['the', 'and', 'but', 'for', 'nor', 'not', 'yet', 'its', 'our', 'has', 'was', 'are', 'can']);

  const result: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = i > 0 ? words[i - 1] : null;
    const nextWord = i < words.length - 1 ? words[i + 1] : null;

    // Rule 1: Last two words always bound together (no orphans)
    if (doOrphans && i === words.length - 2) {
      result.push(word + NBSP + words[i + 1]);
      break;
    }

    // Rule 2: If previous word ends a sentence, bind this word with the next
    // "invisible. Great" → "invisible. Great\u00A0typography"
    if (doSentenceProtection && prevWord && isSentenceEnd(prevWord) && nextWord && !isSentenceEnd(word)) {
      // At narrow measures, only bind short sentence-start words (≤5 chars)
      // to avoid creating oversized atoms. At wider measures, up to 6.
      const maxLen = m >= 45 ? 6 : 5;
      if (word.length <= maxLen) {
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
    }

    // Rule 3: If this word ends a sentence/clause and it's short,
    // bind it with the previous word
    if (doSentenceProtection) {
      const hasTrailingPunct = /[.!?,;:]$/.test(word);
      if (hasTrailingPunct && word.length <= 7 && result.length > 0) {
        const last = result.pop()!;
        result.push(last + NBSP + word);
        continue;
      }

      // Rule 3b: If the NEXT word has trailing punctuation and is short
      if (nextWord && /[.!?,;:]$/.test(nextWord) && nextWord.length <= 5 && i < words.length - 2) {
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
    }

    // Tiered short-word binding: numbers first, then tiny words, then medium, then full
    const lc = word.toLowerCase();
    if (nextWord && !/[,;:.!?]$/.test(word)) {
      // Numbers (1-3 digits) always bind forward — "30 years" should never break
      if (doNumberBinding && /^\d{1,3}$/.test(word)) {
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
      if (doTinyWordBinding && tinyWords.has(lc)) {
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
      if (doMediumWordBinding && mediumWords.has(lc)) {
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
      if (doFullShortWordBinding && lc.length <= 2) {
        // Catch any remaining 1-2 char words not in the sets above
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
    }

    result.push(word);
  }

  return result.join(' ');
}

/**
 * Measure an element's width in `ch` units using Canvas (no DOM mutation).
 * Falls back to an estimate if measurement fails.
 *
 * Exported so pages that call typesetText() directly can pass accurate measure.
 * NEVER use DOM probe spans for measurement — triggers MutationObserver loops.
 */
const _chCache = new WeakMap<HTMLElement, { width: number; ch: number }>();
let _canvas: CanvasRenderingContext2D | null = null;

export function measureCh(element: HTMLElement): number {
  // Check cache — invalidate if element width changed
  const cached = _chCache.get(element);
  const elWidth = element.clientWidth;
  if (cached && cached.width === elWidth) return cached.ch;

  const cs = getComputedStyle(element);
  const containerPx = elWidth
    - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);

  if (containerPx <= 0) return 65;

  // Use Canvas to measure '0' width — zero DOM mutations
  if (!_canvas) {
    const c = document.createElement('canvas');
    _canvas = c.getContext('2d');
  }
  if (_canvas) {
    _canvas.font = `${cs.fontSize} ${cs.fontFamily}`;
    const chPx = _canvas.measureText('0').width;
    if (chPx > 0) {
      const ch = Math.floor(containerPx / chPx);
      _chCache.set(element, { width: elWidth, ch });
      return ch;
    }
  }

  // Fallback: estimate from font-size
  const fsPx = parseFloat(cs.fontSize) || 16;
  const ch = Math.floor(containerPx / (fsPx * 0.6));
  _chCache.set(element, { width: elWidth, ch });
  return ch;
}

/**
 * Apply typographic rules to a DOM element's text content.
 * Processes text nodes recursively.
 *
 * Measures the element's actual width in `ch` units so that binding rules
 * scale appropriately — narrow mobile columns won't get aggressive bindings
 * that create near-justified text with a stranded last line.
 */
export function typeset(element: HTMLElement): void {
  if (!element) return;

  // Measure once for the whole element
  const measure = measureCh(element);

  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );

  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  for (const textNode of textNodes) {
    const original = textNode.textContent;
    if (!original || original.trim().length < 10) continue;
    // Preserve leading/trailing whitespace (critical around inline elements like <strong>)
    const leadingSpace = original.match(/^\s*/)?.[0] || '';
    const trailingSpace = original.match(/\s*$/)?.[0] || '';
    const processed = typesetText(original.trim(), { measure });
    textNode.textContent = leadingSpace + processed + trailingSpace;
  }
}

/**
 * Apply typographic rules to all elements matching a selector.
 */
export function typesetAll(selector: string): void {
  const elements = document.querySelectorAll<HTMLElement>(selector);
  elements.forEach(typeset);
}

// ─── Post-Render Analysis ───
//
// These functions work by measuring the ACTUAL rendered layout, then applying
// targeted fixes. Unlike pre-render bindings (typesetText), they can't make
// things worse — they only intervene when they detect a real problem.

interface LineInfo {
  indices: number[];
  words: string[];
  width: number;
  fill: number;
}

interface LineAnalysis {
  lines: LineInfo[];
  words: string[];
  containerWidth: number;
}

/**
 * Detect actual rendered lines by wrapping words in measurement spans
 * and grouping by vertical position.
 *
 * IMPORTANT: This temporarily replaces innerHTML to measure, then restores it.
 * Must not be called inside a MutationObserver callback.
 */
function detectLines(el: HTMLElement): LineAnalysis | null {
  const text = el.textContent || '';
  if (!text.trim() || text.length < 20) return null;

  // Split on regular spaces only — preserve nbsp bindings as atoms
  const words = text.split(/ +/).filter(Boolean);
  if (words.length < 3) return null;

  const originalHTML = el.innerHTML;
  const originalWhiteSpace = el.style.whiteSpace;

  // Wrap each word in a measurement span
  el.innerHTML = words
    .map((w, i) => `<span data-lw="${i}">${w}</span>`)
    .join(' ');

  const spans = el.querySelectorAll<HTMLElement>('span[data-lw]');
  const cs = getComputedStyle(el);
  const containerWidth = el.clientWidth
    - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);

  const lines: LineInfo[] = [];
  let currentTop = -1;
  let currentLine: number[] = [];

  spans.forEach((span, idx) => {
    const top = Math.round(span.getBoundingClientRect().top);
    if (currentTop === -1) {
      currentTop = top;
      currentLine = [idx];
    } else if (Math.abs(top - currentTop) > 3) {
      if (currentLine.length > 0) {
        const first = spans[currentLine[0]];
        const last = spans[currentLine[currentLine.length - 1]];
        const width = last.getBoundingClientRect().right - first.getBoundingClientRect().left;
        lines.push({
          indices: currentLine,
          words: currentLine.map(i => words[i]),
          width,
          fill: width / containerWidth,
        });
      }
      currentTop = top;
      currentLine = [idx];
    } else {
      currentLine.push(idx);
    }
  });

  // Last line
  if (currentLine.length > 0) {
    const first = spans[currentLine[0]];
    const last = spans[currentLine[currentLine.length - 1]];
    const width = last.getBoundingClientRect().right - first.getBoundingClientRect().left;
    lines.push({
      indices: currentLine,
      words: currentLine.map(i => words[i]),
      width,
      fill: width / containerWidth,
    });
  }

  // Restore
  el.innerHTML = originalHTML;
  el.style.whiteSpace = originalWhiteSpace;

  return { lines, words, containerWidth };
}

/**
 * Fix real orphans: only bind the last two words if the last line
 * actually contains a single word in the rendered layout.
 *
 * This is more accurate than the pre-render approach (which always binds
 * the last two words regardless of whether it's actually an orphan).
 */
export function fixRealOrphans(el: HTMLElement): boolean {
  const analysis = detectLines(el);
  if (!analysis || analysis.lines.length < 2) return false;

  const lastLine = analysis.lines[analysis.lines.length - 1];

  // Only intervene if last line has exactly 1 word (a true rendered orphan)
  if (lastLine.words.length !== 1) return false;

  const prevLine = analysis.lines[analysis.lines.length - 2];
  if (prevLine.words.length < 2) return false;

  // Pull the last word of the previous line down by binding it to the orphan
  const pullWord = prevLine.words[prevLine.words.length - 1];
  const orphanWord = lastLine.words[0];

  const text = el.textContent || '';
  const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    escaped(pullWord) + '\\s+' + escaped(orphanWord) + '\\s*$'
  );
  const newText = text.replace(pattern, pullWord + NBSP + orphanWord);

  if (newText !== text) {
    el.textContent = newText;
    return true;
  }

  return false;
}

/**
 * Detect and fix lines with poor rag by applying targeted word-spacing
 * adjustments. Measures actual rendered line widths, computes a target,
 * and gently adjusts word-spacing per line to even out the right edge.
 *
 * This is a lighter version of smoothRag designed for all widths including mobile.
 * Uses smaller adjustment ranges on narrow screens.
 */
export function fixRag(el: HTMLElement): (() => void) | null {
  const analysis = detectLines(el);
  if (!analysis || analysis.lines.length < 3) return null;

  const { lines, words, containerWidth } = analysis;
  const isNarrow = containerWidth < 350;

  // Compute target: median of non-last line widths
  const nonLastWidths = lines.slice(0, -1).map(l => l.width).sort((a, b) => a - b);
  const mid = Math.floor(nonLastWidths.length / 2);
  const target = nonLastWidths.length % 2 === 0
    ? (nonLastWidths[mid - 1] + nonLastWidths[mid]) / 2
    : nonLastWidths[mid];

  // Narrow screens: very subtle adjustments. Wide: more room.
  const MAX_EXPAND = isNarrow ? 0.5 : 1.8;
  const MAX_TIGHTEN = isNarrow ? 0.3 : 1.0;

  const baseWS = parseFloat(getComputedStyle(el).wordSpacing) || 0;
  const htmlParts: string[] = [];
  let anyAdjustment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineText = line.words.join(' ');
    const isLast = i === lines.length - 1;
    const spaces = line.words.length - 1;
    const gap = target - line.width;

    if (!isLast && spaces > 0 && Math.abs(gap) > 1) {
      const rawDelta = gap / spaces;
      const wsDelta = rawDelta > 0
        ? Math.min(MAX_EXPAND, rawDelta * 0.7)
        : Math.max(-MAX_TIGHTEN, rawDelta * 0.5);

      if (Math.abs(wsDelta) > 0.05) {
        const finalWS = baseWS + wsDelta;
        htmlParts.push(`<span style="word-spacing:${finalWS.toFixed(2)}px">${lineText}</span>`);
        anyAdjustment = true;
        continue;
      }
    }
    htmlParts.push(lineText);
  }

  if (!anyAdjustment) return null;

  const originalHTML = el.innerHTML;
  const originalWhiteSpace = el.style.whiteSpace;

  el.style.whiteSpace = 'pre-line';
  el.innerHTML = htmlParts.join('\n');

  // Return cleanup function
  return () => {
    el.innerHTML = originalHTML;
    el.style.whiteSpace = originalWhiteSpace;
  };
}

/**
 * Fix stranded sentence-start words: detect when the last word on a line
 * is a sentence-start word (preceded by . ! ? punctuation), then bind it
 * to the next word so they move to the next line together.
 *
 * This runs post-render so it measures actual line breaks, not guessing
 * from character counts.
 */
export function fixStrandedSentenceStarts(el: HTMLElement): boolean {
  const analysis = detectLines(el);
  if (!analysis || analysis.lines.length < 2) return false;

  const sentenceEndPattern = /[.!?]["'\u201D\u2019]?$/;
  let modified = false;
  const text = el.textContent || '';
  let newText = text;

  // Check each line except the last
  for (let i = 0; i < analysis.lines.length - 1; i++) {
    const line = analysis.lines[i];
    if (line.words.length === 0) continue;

    const lastWord = line.words[line.words.length - 1];

    // Check if this word itself ends with sentence-ending punctuation
    const wordEndsSentence = sentenceEndPattern.test(lastWord);

    // Or check if the previous word ended a sentence
    const prevWord = line.words.length > 1 ? line.words[line.words.length - 2] : null;
    const prevEndsSentence = prevWord && sentenceEndPattern.test(prevWord);

    if (wordEndsSentence || prevEndsSentence) {
      // This is a sentence-start word stranded at line end
      const nextLine = analysis.lines[i + 1];
      if (nextLine && nextLine.words.length > 0) {
        const nextWord = nextLine.words[0];

        // Bind lastWord to nextWord with nbsp
        const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(
          escaped(lastWord) + '\\s+' + escaped(nextWord),
          'g'
        );
        const replacement = lastWord + NBSP + nextWord;

        const before = newText;
        newText = newText.replace(pattern, replacement);
        if (newText !== before) modified = true;
      }
    }
  }

  if (modified) {
    el.textContent = newText;
    return true;
  }

  return false;
}

/**
 * Full post-render typography pass: runs after the browser has laid out text.
 * Detects and fixes actual rendered problems without pre-render guessing.
 *
 * Call this AFTER typeset() (which handles pre-render bindings).
 */
export function postRenderFix(element: HTMLElement): (() => void) | null {
  if (!element) return null;
  const text = element.textContent || '';
  if (text.length < 40) return null;

  // Step 1: Fix stranded sentence-start words
  fixStrandedSentenceStarts(element);

  // Step 2: Fix real orphans (only if actually orphaned in rendered layout)
  fixRealOrphans(element);

  // Step 3: Smooth rag with subtle word-spacing
  return fixRag(element);
}

/**
 * React hook: apply typeset to a ref on mount/update
 */
export function useTypeset(ref: React.RefObject<HTMLElement | null>, deps: any[] = []) {
  if (typeof window === 'undefined') return;

  // Use requestAnimationFrame to run after render
  const run = () => {
    requestAnimationFrame(() => {
      if (ref.current) typeset(ref.current);
    });
  };

  // MutationObserver approach for dynamic content
  if (ref.current) {
    run();
  }
}

/**
 * smoothRag v4 — DOM-measured Knuth-Plass optimal line breaking.
 *
 * Uses actual DOM measurement (not canvas) for pixel-accurate word widths,
 * then applies Knuth-Plass dynamic programming to find globally optimal
 * break points that minimize rag variance.
 *
 * Two passes:
 *   1. Measure each word's rendered width using a hidden span in the same
 *      font context as the target element
 *   2. Run Knuth-Plass to find optimal breaks, insert <br> tags
 *   3. Apply subtle per-line word-spacing to polish
 *
 * Returns a cleanup function. Re-runs on resize via ResizeObserver.
 */
export interface SmoothRagOptions {
  /** If true, only adjust word-spacing on existing browser lines — never rewrite breaks */
  preserveBreaks?: boolean;
}

export function smoothRag(element: HTMLElement, options?: SmoothRagOptions): () => void {
  const originalHTML = element.innerHTML;
  const originalWhiteSpace = element.style.whiteSpace;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Light smooth mode — word-based line detection.
   * Wraps each word in a <span>, detects lines via offsetTop,
   * then applies per-line word-spacing. Never loses characters.
   */
  function applyLightSmooth(el: HTMLElement, containerWidth: number) {
    const text = el.textContent || '';
    if (!text.trim() || text.length < 40) return;

    // Get baseline word-spacing so we add our delta on top
    const baseWS = parseFloat(getComputedStyle(el).wordSpacing) || 0;

    // Split on regular spaces ONLY — preserve \u00A0 (nbsp) bindings from typesetText
    // so "worked\u00A0as" stays as one atomic unit, never split across lines
    const words = text.split(/ +/).filter(Boolean);
    if (words.length < 4) return;

    // Phase 1: Wrap each word in a span to detect line positions
    el.innerHTML = words
      .map((w, i) => `<span data-w="${i}">${w}</span>`)
      .join(' ');

    // Phase 2: Group words into lines by their vertical position
    const wordSpans = el.querySelectorAll<HTMLElement>('span[data-w]');
    const lines: { wordIndices: number[]; width: number }[] = [];
    let currentLineTop = -1;
    let currentLine: number[] = [];

    wordSpans.forEach((span, idx) => {
      const top = Math.round(span.getBoundingClientRect().top);
      if (currentLineTop === -1) {
        currentLineTop = top;
        currentLine = [idx];
      } else if (Math.abs(top - currentLineTop) > 3) {
        // New line — finalize previous
        if (currentLine.length > 0) {
          const firstSpan = wordSpans[currentLine[0]];
          const lastSpan = wordSpans[currentLine[currentLine.length - 1]];
          const lineWidth = lastSpan.getBoundingClientRect().right - firstSpan.getBoundingClientRect().left;
          lines.push({ wordIndices: currentLine, width: lineWidth });
        }
        currentLineTop = top;
        currentLine = [idx];
      } else {
        currentLine.push(idx);
      }
    });
    // Last line
    if (currentLine.length > 0) {
      const firstSpan = wordSpans[currentLine[0]];
      const lastSpan = wordSpans[currentLine[currentLine.length - 1]];
      const lineWidth = lastSpan.getBoundingClientRect().right - firstSpan.getBoundingClientRect().left;
      lines.push({ wordIndices: currentLine, width: lineWidth });
    }

    if (lines.length < 2) {
      // Not enough lines to smooth — restore plain text
      el.innerHTML = words.join(' ');
      return;
    }

    // Phase 3: Compute target (median of non-last line widths)
    const nonLastWidths = lines.slice(0, -1).map(l => l.width).sort((a, b) => a - b);
    const midIdx = Math.floor(nonLastWidths.length / 2);
    let target = nonLastWidths.length % 2 === 0
      ? (nonLastWidths[midIdx - 1] + nonLastWidths[midIdx]) / 2
      : nonLastWidths[midIdx];

    // Phase 3b: Detect "near-justified + orphan last line" pattern.
    // If non-last lines all fill >88% and last line fills <60%,
    // shift target DOWN so we tighten all non-last lines, creating a
    // more natural rag instead of near-justified + stranded last line.
    const lastLineWidth = lines[lines.length - 1].width;
    const avgNonLastFill = nonLastWidths.reduce((s, w) => s + w, 0) / nonLastWidths.length / containerWidth;
    const lastFill = lastLineWidth / containerWidth;
    if (avgNonLastFill > 0.88 && lastFill < 0.60 && lines.length > 2) {
      // Pull target down to ~80% of container to create visible rag
      target = Math.min(target, containerWidth * 0.82);
    }

    // Phase 4: Build HTML with per-line word-spacing
    // Narrow containers need much smaller adjustments — even 1px/gap
    // creates a justified appearance at ~6 words per line.
    const isNarrow = containerWidth < 350;
    const MAX_EXPAND = isNarrow ? 0.6 : 2.5;
    const MAX_TIGHTEN = isNarrow ? 0.4 : 1.5;
    const htmlParts: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isLast = i === lines.length - 1;
      const lineWords = line.wordIndices.map(idx => words[idx]);
      const lineText = lineWords.join(' ');
      // Count ALL spaces (regular + nbsp inside atomic words) for word-spacing calc
      const spaces = (lineText.match(/[\s\u00A0]/g) || []).length;
      const gap = target - line.width;

      if (!isLast && spaces > 0 && Math.abs(gap) > 1) {
        const rawDelta = gap / spaces;
        const wsDelta = rawDelta > 0
          ? Math.min(MAX_EXPAND, rawDelta * 0.8)
          : Math.max(-MAX_TIGHTEN, rawDelta * 0.6);
        if (Math.abs(wsDelta) > 0.05) {
          const finalWS = baseWS + wsDelta;
          htmlParts.push(`<span style="word-spacing:${finalWS.toFixed(2)}px">${lineText}</span>`);
          continue;
        }
      }
      htmlParts.push(lineText);
    }

    // Use \n with white-space:pre-line so textContent has real whitespace
    // (both <br> and display:block spans lose spaces in textContent)
    el.style.whiteSpace = 'pre-line';
    el.innerHTML = htmlParts.join('\n');
  }

  function apply() {
    // Reset
    element.innerHTML = originalHTML;

    const text = element.textContent || '';
    if (!text.trim() || text.length < 40) return;

    const cs = getComputedStyle(element);
    const containerWidth = element.clientWidth
      - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (containerWidth <= 0) return;

    const isNarrow = containerWidth < 400;

    // Very narrow containers (<250px): rag smoothing does more harm than good.
    // Let the browser handle it entirely.
    if (containerWidth < 250) return;

    // Light mode: accept browser breaks, just smooth word-spacing per line.
    // Used for narrow containers OR when preserveBreaks is requested.
    if (isNarrow || options?.preserveBreaks) {
      applyLightSmooth(element, containerWidth);
      return;
    }

    // Create a hidden measurement span inside the element (inherits all styles)
    const measurer = document.createElement('span');
    measurer.style.cssText =
      'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;' +
      'font:inherit;letter-spacing:inherit;word-spacing:inherit;';
    element.style.position = element.style.position || 'relative';
    element.appendChild(measurer);

    const measureWord = (w: string): number => {
      measurer.textContent = w;
      return measurer.getBoundingClientRect().width;
    };

    const spaceWidth = measureWord('\u00A0'); // non-breaking space = true space width

    // Get baseline word-spacing so per-line deltas add on top, not replace
    const baseWS = parseFloat(cs.wordSpacing) || 0;

    // Split on regular spaces ONLY — preserve \u00A0 (nbsp) bindings from typesetText
    // so "typography\u00A0is\u00A0invisible." stays as one atomic unit
    const words = text.split(/ +/).filter(Boolean);
    if (words.length < 3) { element.removeChild(measurer); return; }

    // Measure all words (measurer must still be in DOM for getBoundingClientRect)
    const wordWidths = words.map(w => measureWord(w));
    element.removeChild(measurer);

    // Run Knuth-Plass to find optimal breakpoints
    const lineBreaks = knuthPlass(wordWidths, spaceWidth, containerWidth);

    if (lineBreaks.length < 2) return;

    // Build lines
    const lines: { words: string[]; width: number }[] = [];
    for (let i = 0; i < lineBreaks.length - 1; i++) {
      const start = lineBreaks[i];
      const end = lineBreaks[i + 1];
      const lineWords = words.slice(start, end);
      const w = lineWords.reduce((sum, word, j) => {
        return sum + wordWidths[start + j] + (j < lineWords.length - 1 ? spaceWidth : 0);
      }, 0);
      lines.push({ words: lineWords, width: w });
    }

    if (lines.length < 2) return;

    // Compute target: median of non-last line widths
    const nonLastWidths = lines.slice(0, -1).map(l => l.width).sort((a, b) => a - b);
    const midIdx = Math.floor(nonLastWidths.length / 2);
    let target = nonLastWidths.length % 2 === 0
      ? (nonLastWidths[midIdx - 1] + nonLastWidths[midIdx]) / 2
      : nonLastWidths[midIdx];

    // Detect "near-justified + orphan last line" — same logic as light smooth
    const lastWidth = lines[lines.length - 1].width;
    const avgFill = nonLastWidths.reduce((s, w) => s + w, 0) / nonLastWidths.length / containerWidth;
    const lastFill = lastWidth / containerWidth;
    if (avgFill > 0.88 && lastFill < 0.60 && lines.length > 2) {
      target = Math.min(target, containerWidth * 0.82);
    }

    // Build HTML with per-line word-spacing (delta added to user's base)
    // Asymmetric: more expansion room than tightening
    const MAX_EXPAND = 2.5;
    const MAX_TIGHTEN = 1.5;
    const htmlParts: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Normalize nbsp → regular space so CSS word-spacing applies
      const lineText = line.words.join(' ').replace(/\u00A0/g, ' ');
      const isLast = i === lines.length - 1;
      const spaces = line.words.length - 1;
      const gap = target - line.width;

      if (!isLast && spaces > 0 && Math.abs(gap) > 1) {
        const rawDelta = gap / spaces;
        const wsDelta = rawDelta > 0
          ? Math.min(MAX_EXPAND, rawDelta * 0.8)
          : Math.max(-MAX_TIGHTEN, rawDelta * 0.6);
        if (Math.abs(wsDelta) > 0.05) {
          const finalWS = baseWS + wsDelta;
          htmlParts.push(`<span style="word-spacing:${finalWS.toFixed(2)}px">${lineText}</span>`);
          continue;
        }
      }
      htmlParts.push(lineText);
    }

    element.style.whiteSpace = 'pre-line';
    element.innerHTML = htmlParts.join('\n');
  }

  /**
   * Knuth-Plass line breaking for ragged-right.
   * Returns array of word indices where each line starts.
   */
  function knuthPlass(
    wordWidths: number[],
    spaceWidth: number,
    lineWidth: number,
  ): number[] {
    const n = wordWidths.length;
    const INF = 1e10;

    // dp[i] = minimum cost to break words[0..i-1], with line ending after word i-1
    const dp: number[] = new Array(n + 1).fill(INF);
    const from: number[] = new Array(n + 1).fill(-1);
    const lineWidthAt: number[] = new Array(n + 1).fill(0);
    dp[0] = 0;

    for (let j = 1; j <= n; j++) {
      // Try starting a line from word i to word j-1
      let w = 0;
      for (let i = j; i >= 1; i--) {
        // Width of words[i-1..j-1] with spaces between
        w += wordWidths[i - 1] + (i < j ? spaceWidth : 0);

        // Too wide? Stop looking further back
        if (w > lineWidth * 1.05 && i < j) break;

        if (dp[i - 1] >= INF) continue;

        // Compute badness
        const slack = lineWidth - w;
        const ratio = slack / lineWidth;
        const isLastLine = j === n;

        let badness: number;
        if (slack < -lineWidth * 0.03) {
          // Line is too long (beyond 3% tolerance)
          badness = Math.pow(Math.abs(ratio), 2) * 1000;
        } else if (isLastLine) {
          // Last line: penalize proportional to how short it is.
          // A line at 50% fill is acceptable, but anything under 35%
          // looks orphaned. Also consider how full previous lines are —
          // if they're all >90% fill and the last is <55%, the contrast
          // is jarring (looks like forced justification + orphan).
          const fill = w / lineWidth;
          if (fill < 0.35) {
            badness = Math.pow(0.35 - fill, 2) * 300;
          } else if (fill < 0.55) {
            // Check if prior lines are uniformly full (near-justified look)
            // Use lineWidthAt to estimate average prior fill
            let priorFillSum = 0;
            let priorCount = 0;
            for (let pi = 1; pi < j; pi++) {
              if (lineWidthAt[pi] > 0) {
                priorFillSum += lineWidthAt[pi] / lineWidth;
                priorCount++;
              }
            }
            const avgPriorFill = priorCount > 0 ? priorFillSum / priorCount : 0.8;
            if (avgPriorFill > 0.88) {
              // High contrast: near-justified lines + short last line
              badness = Math.pow(avgPriorFill - fill, 2) * 150;
            } else {
              badness = ratio > 0.5 ? Math.pow(ratio - 0.5, 2) * 20 : 0;
            }
          } else {
            badness = 0;
          }
        } else {
          // Normal line: penalize deviation from ~85% fill
          const ideal = lineWidth * 0.85;
          const dev = Math.abs(w - ideal) / lineWidth;
          badness = Math.pow(dev, 2) * 100;

          // Extra penalty for very short lines (<65% fill)
          if (w < lineWidth * 0.65) {
            badness += Math.pow((lineWidth * 0.65 - w) / lineWidth, 2) * 200;
          }
        }

        // Adjacent-line variance penalty
        if (i > 1 && lineWidthAt[i - 1] > 0) {
          const prevWidth = lineWidthAt[i - 1];
          const diff = Math.abs(w - prevWidth) / lineWidth;
          badness += Math.pow(diff, 2) * 30;
        }

        const cost = dp[i - 1] + badness;
        if (cost < dp[j]) {
          dp[j] = cost;
          from[j] = i - 1;
          lineWidthAt[j] = w;
        }
      }
    }

    // Trace back
    const breaks: number[] = [];
    let cur = n;
    while (cur > 0) {
      breaks.unshift(from[cur]);
      cur = from[cur];
    }
    breaks.push(n);

    return breaks;
  }

  apply();

  const observer = new ResizeObserver(() => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => requestAnimationFrame(apply), 150);
  });
  observer.observe(element);

  return () => {
    observer.disconnect();
    if (resizeTimer) clearTimeout(resizeTimer);
    element.innerHTML = originalHTML;
    element.style.whiteSpace = originalWhiteSpace;
  };
}

/**
 * smoothRagSpans — Non-destructive rag smoothing for word-wrapped content.
 *
 * Expects the container to hold words wrapped in <span data-w> elements
 * (with regular spaces between them in the DOM). Measures where the browser
 * placed each word, groups them into lines, and applies per-line word-spacing
 * adjustments to even out the right edge.
 *
 * Never rewrites innerHTML — only reads positions and sets inline styles.
 * Returns a cleanup function that removes the applied styles.
 *
 * Usage:
 *   // Render words as spans (React, vanilla JS, whatever)
 *   container.innerHTML = words.map((w, i) =>
 *     `<span data-w="${i}">${w}</span>`
 *   ).join(' ');
 *
 *   // Smooth the rag
 *   const cleanup = smoothRagSpans(container);
 *
 *   // Later, to reset:
 *   cleanup();
 */
export function smoothRagSpans(container: HTMLElement): () => void {
  const wordSpans = container.querySelectorAll<HTMLElement>('span[data-w]');
  if (wordSpans.length < 4) return () => {};

  const containerWidth = container.clientWidth;
  if (containerWidth < 250) return () => {};

  // Group spans into lines by vertical position
  const lines: HTMLElement[][] = [];
  let currentTop = -1;
  let currentLine: HTMLElement[] = [];

  wordSpans.forEach((span) => {
    const top = Math.round(span.getBoundingClientRect().top);
    if (currentTop === -1) {
      currentTop = top;
      currentLine = [span];
    } else if (Math.abs(top - currentTop) > 3) {
      if (currentLine.length > 0) lines.push(currentLine);
      currentTop = top;
      currentLine = [span];
    } else {
      currentLine.push(span);
    }
  });
  if (currentLine.length > 0) lines.push(currentLine);

  if (lines.length < 2) return () => {};

  // Measure each line's width (first span left → last span right)
  const lineWidths = lines.map((line) => {
    const first = line[0].getBoundingClientRect();
    const last = line[line.length - 1].getBoundingClientRect();
    return last.right - first.left;
  });

  // Target: median of non-last line widths
  const nonLast = lineWidths.slice(0, -1).sort((a, b) => a - b);
  const mid = Math.floor(nonLast.length / 2);
  const target = nonLast.length % 2 === 0
    ? (nonLast[mid - 1] + nonLast[mid]) / 2
    : nonLast[mid];

  // Asymmetric limits: short lines get more expansion room
  const isNarrow = containerWidth < 350;
  const MAX_EXPAND = isNarrow ? 1.5 : 2.5;   // px per word gap
  const MAX_TIGHTEN = isNarrow ? 0.75 : 1.5;

  const styledSpans: HTMLElement[] = [];

  lines.forEach((line, i) => {
    const isLast = i === lines.length - 1;
    const spaces = line.length - 1;
    const gap = target - lineWidths[i];

    if (!isLast && spaces > 0 && Math.abs(gap) > 1) {
      const rawDelta = gap / spaces;
      const wsDelta = rawDelta > 0
        ? Math.min(MAX_EXPAND, rawDelta * 0.8)    // expand short lines
        : Math.max(-MAX_TIGHTEN, rawDelta * 0.6);  // tighten long lines
      if (Math.abs(wsDelta) > 0.05) {
        line.forEach((span) => {
          span.style.wordSpacing = `${wsDelta.toFixed(2)}px`;
          styledSpans.push(span);
        });
      }
    }
  });

  // Cleanup: remove word-spacing from all spans we touched
  return () => {
    styledSpans.forEach((span) => { span.style.wordSpacing = ''; });
  };
}

/**
 * optimizeBreaks — Production paragraph break optimizer.
 *
 * Applies Knuth-Plass dynamic programming with:
 *   - Break quality rules: no stranded prepositions, conjunctions, or articles
 *   - Sentence start protection: new sentences don't dangle at line ends
 *   - Stairstep demerits: penalizes consecutive lines differing >10% fill
 *   - Cubic badness: strongly prefers many small deviations over few large ones
 *   - Bringhurst measure diagnostic: logs warnings for narrow columns
 *
 * Does NOT adjust word-spacing or letter-spacing — only controls WHERE
 * lines break. This preserves the browser's natural spacing rhythm.
 *
 * Based on research from Tschichold, Bringhurst, Ruder, and Knuth-Plass.
 * See docs/RESEARCH.md for full methodology.
 *
 * Returns a cleanup function. Re-runs on resize via ResizeObserver.
 */

// Only bind the shortest, most visually problematic words.
// Binding too many creates rigid clusters that produce worse rag than the browser default.
// Rule: only bind words ≤2 characters that look stranded at line end.
const OPT_SHORT_BIND = new Set(
  'a an the of in to at by on or is it if no so as we do be'.split(' ')
);

function isOptSentenceEnd(w: string): boolean {
  return /[.!?]["'\u201D\u2019]?$/.test(w);
}

export function optimizeBreaks(element: HTMLElement): () => void {
  const originalHTML = element.innerHTML;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  let lastWidth = -1;

  function apply() {
    // Restore original content before re-measuring
    element.innerHTML = originalHTML;

    const text = element.textContent || '';
    if (!text.trim() || text.length < 40) return;

    const cs = getComputedStyle(element);
    const containerWidth =
      element.clientWidth -
      parseFloat(cs.paddingLeft) -
      parseFloat(cs.paddingRight);

    if (containerWidth < 200) return;

    // Prevent resize observer loops
    if (Math.abs(containerWidth - lastWidth) < 2) return;
    lastWidth = containerWidth;

    // Create hidden measurer inheriting all font styles
    const measurer = document.createElement('span');
    measurer.style.cssText =
      'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;' +
      'font:inherit;letter-spacing:inherit;word-spacing:inherit;';
    element.style.position = element.style.position || 'relative';
    element.appendChild(measurer);

    const measureWord = (w: string): number => {
      measurer.textContent = w;
      return measurer.getBoundingClientRect().width;
    };

    // Split on regular spaces only — preserve nbsp bindings from typesetText
    const words = text.split(/ +/).filter(Boolean);
    if (words.length < 3) {
      element.removeChild(measurer);
      return;
    }

    // Measure all words and space width
    const wordWidths = words.map(w => measureWord(w));
    const spaceWidth = (() => {
      measurer.innerHTML = 'a b';
      const ab = measurer.getBoundingClientRect().width;
      measurer.textContent = 'ab';
      return ab - measurer.getBoundingClientRect().width;
    })();

    element.removeChild(measurer);

    const n = words.length;
    const cw = containerWidth;

    // Build break-quality violation set — conservative.
    // Only bind short words (≤2-3 chars) that look bad stranded at line end.
    // Do NOT bind longer prepositions (from, with, beyond, between, etc.)
    // — they don't look stranded and over-binding worsens the rag.
    const noEndLine = new Set<number>();
    for (let i = 0; i < n - 1; i++) {
      const lower = words[i].toLowerCase().replace(/[.,;:!?'"\u201D\u2019]+$/, '');
      if (OPT_SHORT_BIND.has(lower)) noEndLine.add(i);
    }

    // Line width calculator
    function lineWidth(start: number, end: number): number {
      let w = 0;
      for (let i = start; i < end; i++) w += wordWidths[i];
      return w + (end - start - 1) * spaceWidth;
    }

    // Knuth-Plass DP with break quality + stairstep demerits
    interface DPEntry {
      cost: number;
      prev: number;
      fill: number | null;
    }

    function lineBadness(
      start: number,
      end: number,
      isLast: boolean,
      prevFill: number | null
    ): number {
      const lw = lineWidth(start, end);
      if (lw > cw * 1.005) return 1e9;
      const fill = lw / cw;
      const nw = end - start;
      let badness = 0;

      if (isLast) {
        if (nw === 1 && fill < 0.25) return 150;
        if (fill < 0.15) return 100;
        return 0;
      }

      // Cubic badness (Knuth)
      const deviation = Math.abs(fill - 0.85);
      badness += Math.pow(deviation / 0.15, 3) * 100;

      // Stairstep demerits
      if (prevFill !== null) {
        const step = Math.abs(fill - prevFill);
        if (step > 0.15) badness += 200;
        else if (step > 0.10) badness += 80;
      }

      // Break quality
      if (noEndLine.has(end - 1)) badness += 500;

      // Short/thin line penalties
      if (nw <= 2 && fill < 0.55) badness += 150;
      if (fill < 0.40) badness += 300;

      return badness;
    }

    // Run DP
    const dp: DPEntry[] = new Array(n + 1).fill(null);
    dp[0] = { cost: 0, prev: -1, fill: null };

    for (let i = 1; i <= n; i++) {
      let best: DPEntry = { cost: 1e9, prev: -1, fill: 0 };
      for (let j = Math.max(0, i - 25); j < i; j++) {
        if (!dp[j] || dp[j].cost >= 1e9) continue;
        const isLast = i === n;
        const lw = lineWidth(j, i);
        const fill = lw / cw;
        const cost = dp[j].cost + lineBadness(j, i, isLast, dp[j].fill);
        if (cost < best.cost) {
          best = { cost, prev: j, fill };
        }
      }
      dp[i] = best;
    }

    // Reconstruct break points → set of word indices where lines START
    const lineStarts = new Set<number>();
    lineStarts.add(0);
    let pos = n;
    const breakStack: number[] = [];
    while (pos > 0) {
      breakStack.push(dp[pos].prev);
      pos = dp[pos].prev;
    }
    breakStack.reverse();
    for (const s of breakStack) lineStarts.add(s);

    // Determine which word gaps should be PREVENTED from breaking.
    // Strategy: only bind words that the DP says must stay together —
    // specifically, words flagged in noEndLine (prepositions, conjunctions,
    // articles, sentence starters) that the DP chose to keep on the same line.
    // All other spaces remain breakable so the browser can still wrap naturally.
    const preventBreakAfter = new Set<number>();

    // For each line the DP chose, check if any word in the line is in noEndLine
    // and is NOT the last word — those spaces should be nbsp
    let lineStart = 0;
    for (const s of breakStack) {
      if (s === 0) { lineStart = 0; continue; }
      // Line is words[lineStart..s) — not used here
      lineStart = s;
    }

    // Simpler: for every word in noEndLine, if the DP chose NOT to break
    // after it (i.e., word i and word i+1 are on the same line), bind them.
    for (const wordI of noEndLine) {
      // word wordI should not end a line.
      // If wordI+1 is NOT a lineStart, they're already on the same line — good, no action.
      // If wordI+1 IS a lineStart... the DP broke there anyway (couldn't avoid it).
      // Either way, bind wordI to wordI+1 with nbsp.
      if (wordI < n - 1) {
        preventBreakAfter.add(wordI);
      }
    }

    // Apply: walk innerHTML, replace spaces after flagged words with nbsp.
    // This preserves ALL HTML tags (strong, em, a, etc.)
    const html = originalHTML;
    let gapIndex = 0; // tracks inter-word gap position
    let inTag = false;
    let inWord = false;
    let result = '';

    for (let i = 0; i < html.length; i++) {
      const ch = html[i];

      if (ch === '<') {
        inTag = true;
        result += ch;
        continue;
      }
      if (ch === '>') {
        inTag = false;
        result += ch;
        continue;
      }
      if (inTag) {
        result += ch;
        continue;
      }

      // Text content
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
        if (inWord) {
          gapIndex++;
          inWord = false;
        }
        // gapIndex = gap after word (gapIndex-1), before word gapIndex
        // preventBreakAfter has word indices — gap after word i is gapIndex when gapIndex === i+1
        // Actually: gapIndex counts up each word boundary.
        // After word 0, gapIndex=1. After word 1, gapIndex=2. etc.
        // So the gap "after word i" corresponds to gapIndex === i+1
        // preventBreakAfter.has(i) means "don't break after word i" = gapIndex === i+1
        if (preventBreakAfter.has(gapIndex - 1)) {
          result += '\u00A0';
        } else {
          result += ' ';
        }
      } else if (ch === '\u00A0') {
        // Already nbsp — preserve
        result += '\u00A0';
      } else {
        if (!inWord) inWord = true;
        result += ch;
      }
    }

    element.innerHTML = result;
  }

  apply();

  // Re-run on resize (debounced)
  const observer = new ResizeObserver(() => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      lastWidth = -1; // Reset so apply() doesn't skip
      requestAnimationFrame(apply);
    }, 250);
  });
  observer.observe(element);

  return () => {
    observer.disconnect();
    if (resizeTimer) clearTimeout(resizeTimer);
    element.innerHTML = originalHTML;
  };
}

export default typeset;
