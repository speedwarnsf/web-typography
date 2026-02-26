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
  return typesetBodyText(text);
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
function typesetBodyText(text: string): string {
  if (!text || text.length < 10) return text;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) return text;

  const result: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = i > 0 ? words[i - 1] : null;
    const nextWord = i < words.length - 1 ? words[i + 1] : null;

    // Rule 1: Last two words always bound together (no orphans)
    if (i === words.length - 2) {
      result.push(word + NBSP + words[i + 1]);
      break;
    }

    // Rule 2: If previous word ends a sentence, bind this word with the next
    // (don't let a sentence start be alone at end of a line)
    // Catches: "stage. Tempo sets" → "stage. Tempo\u00A0sets"
    if (prevWord && isSentenceEnd(prevWord) && nextWord && !isSentenceEnd(word)) {
      if (word.length <= 6) {
        result.push(word + NBSP + words[i + 1]);
        i++; // skip next word, already consumed
        continue;
      }
    }

    // Rule 3: If this word ends a sentence/clause and it's short (1-5 chars),
    // bind it with the previous word so it doesn't dangle alone
    // Catches: "out." "out," "go." "it," "way" before punctuated words, etc.
    const hasTrailingPunct = /[.!?,;:]$/.test(word);
    if (hasTrailingPunct && word.length <= 7 && result.length > 0) {
      const last = result.pop()!;
      result.push(last + NBSP + word);
      continue;
    }

    // Rule 3b: If the NEXT word has trailing punctuation and is short,
    // bind this word + next together (e.g. "way out," stays together)
    if (nextWord && /[.!?,;:]$/.test(nextWord) && nextWord.length <= 5 && i < words.length - 2) {
      result.push(word + NBSP + words[i + 1]);
      i++;
      continue;
    }

    // Rule: Bind prepositions/articles with the next word
    // (prevents dangling "a", "to", "in", "of", "the", "is", "it", etc.)
    const shortWords = ['a', 'an', 'the', 'to', 'in', 'on', 'of', 'is', 'it', 'or', 'at', 'by', 'if', 'no', 'so', 'up', 'as', 'we', 'my', 'do', 'be'];
    // Only bind if the word has NO trailing punctuation (skip "of," "in," etc. in lists)
    if (shortWords.includes(word.toLowerCase()) && nextWord && !/[,;:.!?]$/.test(word)) {
      // Bind to BOTH previous and next word — prevents "of" from being at a line break
      // e.g. "center of gravity" becomes "center\u00A0of\u00A0gravity"
      if (result.length > 0) {
        const prev = result.pop()!;
        result.push(prev + NBSP + word + NBSP + words[i + 1]);
      } else {
        result.push(word + NBSP + words[i + 1]);
      }
      i++;
      continue;
    }

    result.push(word);
  }

  return result.join(' ');
}

/**
 * Apply typographic rules to a DOM element's text content.
 * Processes text nodes recursively.
 */
export function typeset(element: HTMLElement): void {
  if (!element) return;

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
    const processed = typesetText(original.trim());
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
export function smoothRag(element: HTMLElement): () => void {
  const originalHTML = element.innerHTML;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  function apply() {
    // Reset
    element.innerHTML = originalHTML;

    const text = element.textContent || '';
    if (!text.trim() || text.length < 40) return;

    const cs = getComputedStyle(element);
    const containerWidth = element.clientWidth
      - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (containerWidth <= 0) return;

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

    const words = text.split(/\s+/).filter(Boolean);
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

    // Compute target (90th percentile of non-last line widths)
    const nonLastWidths = lines.slice(0, -1).map(l => l.width).sort((a, b) => a - b);
    const p90 = nonLastWidths[Math.min(nonLastWidths.length - 1, Math.floor(nonLastWidths.length * 0.9))];

    // Build HTML with per-line word-spacing
    const MAX_WS = 2.0;
    const htmlParts: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineText = line.words.join(' ');
      const isLast = i === lines.length - 1;
      const spaces = line.words.length - 1;
      const gap = p90 - line.width;

      if (!isLast && spaces > 0 && Math.abs(gap) > 1) {
        const ws = Math.max(-MAX_WS, Math.min(MAX_WS, (gap * 0.65) / spaces));
        if (Math.abs(ws) > 0.05) {
          htmlParts.push(`<span style="word-spacing:${ws.toFixed(2)}px">${lineText}</span>`);
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
          // Last line: very lenient — only penalize if very short
          badness = ratio > 0.5 ? Math.pow(ratio - 0.5, 2) * 20 : 0;
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

export default typeset;
