/**
 * typeset.ts — Typographic utilities for clean, professional web text.
 * Prevents orphans, binds short words, smooths rag, and protects
 * sentence boundaries using non-breaking spaces (&nbsp;).
 *
 * Usage: typeset("Your paragraph text here")
 */

/** Replace the last space with &nbsp; so the final line has at least 2 words. */
export function preventOrphans(text: string): string {
  const lastSpaceIndex = text.lastIndexOf(" ");
  if (lastSpaceIndex === -1) return text;
  return (
    text.slice(0, lastSpaceIndex) + "\u00A0" + text.slice(lastSpaceIndex + 1)
  );
}

/** Bind the first two words of each sentence so a line never starts with a lonely word. */
export function protectSentenceStart(text: string): string {
  return text.replace(/([.!?])\s+(\w+)\s+/g, "$1 $2\u00A0");
}

/** Prevent a single short word from dangling at the end of a sentence. */
export function protectSentenceEnd(text: string): string {
  return text.replace(/\s+(\w{1,3})([.!?])/g, "\u00A0$1$2");
}

/** Bind short prepositions/conjunctions (1-3 chars) to the next word. */
export function bindShortWords(text: string): string {
  return text.replace(
    /\s(a|an|the|in|on|at|to|by|of|or|is|it|as|if|so|no|do|up|we|he|me|my|be|am)\s/gi,
    (match, word) => ` ${word}\u00A0`
  );
}

/**
 * Smooth rag by inserting &nbsp; before words that would jut out
 * beyond a target line length, pulling them down to the next line.
 */
export function smoothRag(text: string, targetLineLength = 65): string {
  const words = text.split(" ");
  let currentLength = 0;
  const result: string[] = [];

  for (const word of words) {
    if (
      currentLength > 0 &&
      currentLength + word.length + 1 > targetLineLength
    ) {
      // Insert a non-breaking space before this word to keep it
      // attached to the previous word, smoothing the rag.
      result.push("\u00A0" + word);
      currentLength = word.length;
    } else {
      if (currentLength > 0) {
        result.push(" " + word);
        currentLength += word.length + 1;
      } else {
        result.push(word);
        currentLength = word.length;
      }
    }
  }

  return result.join("");
}

/** Apply all typographic rules in sequence. */
export function typeset(text: string): string {
  let result = text;
  result = bindShortWords(result);
  result = protectSentenceStart(result);
  result = protectSentenceEnd(result);
  result = preventOrphans(result);
  return result;
}

export default typeset;
