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
  // Tiny words (1-2 chars) are safe to bind at ANY width — they never
  // cause overflow. Sentence protection works at medium widths. The full
  // set of prepositions/articles only binds at wide measures where the
  // extra atoms won't force near-justified lines.
  const m = measure ?? 65;
  const doOrphans = m >= 30;                     // always, except absurdly narrow
  const doTinyWordBinding = m >= 25;             // 1-2 char words: always safe
  const doSentenceProtection = m >= 35;          // sentence start/end: most measures
  const doMediumWordBinding = m >= 45;           // 3-char words (the, to, etc.)
  const doFullShortWordBinding = m >= 55;        // full list: wide measures only

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

    // Tiered short-word binding: tiny words first, then medium, then full
    const lc = word.toLowerCase();
    if (nextWord && !/[,;:.!?]$/.test(word)) {
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
 * Measure an element's width in `ch` units (width of one '0' character).
 * Falls back to an estimate from pixel width if measurement fails.
 */
function measureCh(element: HTMLElement): number {
  const cs = getComputedStyle(element);
  const containerPx = element.clientWidth
    - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);

  // Measure the width of '0' in the element's font context
  const probe = document.createElement('span');
  probe.style.cssText =
    'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;' +
    'font:inherit;letter-spacing:inherit;';
  probe.textContent = '0000000000'; // 10 zeros
  element.appendChild(probe);
  const chPx = probe.getBoundingClientRect().width / 10;
  element.removeChild(probe);

  if (chPx <= 0) return 65; // fallback
  return Math.floor(containerPx / chPx);
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

    // Split on any whitespace (regular + nbsp), preserving word content
    const words = text.split(/[\s\u00A0]+/).filter(Boolean);
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
    const isNarrow = containerWidth < 350;
    const MAX_EXPAND = isNarrow ? 1.5 : 2.5;
    const MAX_TIGHTEN = isNarrow ? 0.75 : 1.5;
    const htmlParts: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isLast = i === lines.length - 1;
      const lineWords = line.wordIndices.map(idx => words[idx]);
      const lineText = lineWords.join(' ');
      const spaces = lineWords.length - 1;
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

    el.innerHTML = htmlParts.join('<br>');
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

    element.innerHTML = htmlParts.join('<br>');
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

export default typeset;
