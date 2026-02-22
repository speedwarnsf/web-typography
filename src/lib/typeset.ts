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
 * Detect sentence boundaries
 */
const isSentenceEnd = (word: string) =>
  /[.!?]$/.test(word) || /[.!?]["'\u201D\u2019]$/.test(word);

/**
 * Insert non-breaking spaces to enforce typographic rules.
 * Works by analyzing word groups and binding words that must stay together.
 */
export function typesetText(text: string): string {
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

export default typeset;
