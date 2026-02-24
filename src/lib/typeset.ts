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
 * smoothRag — adjust letter-spacing per line to smooth the right rag edge.
 * Attach to an element; returns a cleanup function.
 * Uses ResizeObserver so it re-runs on resize.
 */
export function smoothRag(element: HTMLElement): () => void {
  const MAX_LS = 0.35; // max letter-spacing in px
  const THRESHOLD = 5;  // min gap in px before adjusting
  const GAP_RATIO = 0.75; // close 75% of the gap

  function apply() {
    // Reset any previous adjustments
    element.style.letterSpacing = '';

    const text = element.textContent || '';
    if (!text.trim()) return;

    // Measure natural line widths using Range API
    const range = document.createRange();
    const textNode = element.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;

    const chars = text.length;
    const lines: { start: number; end: number; width: number }[] = [];
    let lineStart = 0;
    let lastTop = -1;

    for (let i = 0; i <= chars; i++) {
      range.setStart(textNode, Math.min(i, chars));
      range.setEnd(textNode, Math.min(i + 1, chars));
      const rect = range.getBoundingClientRect();
      if (rect.top !== lastTop && i > 0) {
        // New line detected
        range.setStart(textNode, lineStart);
        range.setEnd(textNode, i);
        const lineRect = range.getBoundingClientRect();
        lines.push({ start: lineStart, end: i, width: lineRect.width });
        lineStart = i;
      }
      lastTop = rect.top;
    }
    // Last line
    if (lineStart < chars) {
      range.setStart(textNode, lineStart);
      range.setEnd(textNode, chars);
      const lineRect = range.getBoundingClientRect();
      lines.push({ start: lineStart, end: chars, width: lineRect.width });
    }

    if (lines.length < 2) return;

    // Find the longest non-last line as the target
    const target = Math.max(...lines.slice(0, -1).map(l => l.width));

    // For now, apply uniform letter-spacing based on average gap
    // (per-line adjustment requires wrapping each line in a span, which is more invasive)
    const gaps = lines.slice(0, -1).map(l => target - l.width).filter(g => g > THRESHOLD);
    if (gaps.length === 0) return;

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const avgChars = lines.slice(0, -1).reduce((a, l) => a + (l.end - l.start), 0) / (lines.length - 1);
    const ls = Math.min(MAX_LS, (avgGap * GAP_RATIO) / avgChars);

    if (ls > 0.02) {
      element.style.letterSpacing = `${ls.toFixed(3)}px`;
    }
  }

  apply();

  const observer = new ResizeObserver(() => {
    requestAnimationFrame(apply);
  });
  observer.observe(element);

  return () => observer.disconnect();
}

export default typeset;
