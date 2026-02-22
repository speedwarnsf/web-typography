// Before: regular spaces, text wraps naturally at narrow width.
// After: non-breaking spaces (\u00A0) bind words, changing line breaks.
// At 220px column width the differences are dramatic and visible.

export type Rule = {
  name: string;
  description: string;
  before: string;
  after: string;
  code: string;
};

export const rules: Rule[] = [
  {
    name: "No Orphans",
    description:
      "Replace the last space in a paragraph with a non-breaking space, ensuring the final line always contains at least two words. Prevents lonely words dangling on their own line.",
    before:
      "The campaign launched across fourteen cities with record-breaking attendance.",
    after:
      "The campaign launched across fourteen cities with record-breaking\u00A0attendance.",
    code: `export function preventOrphans(text: string): string {
  const i = text.lastIndexOf(" ");
  if (i === -1) return text;
  return text.slice(0, i) + "\\u00A0" + text.slice(i + 1);
}`,
  },
  {
    name: "Sentence-Start Protection",
    description:
      "Bind the first two words after a sentence boundary so a line never begins with just one word from the new sentence.",
    before:
      "The results exceeded all targets. We expanded into three new markets that year.",
    after:
      "The results exceeded all targets. We\u00A0expanded into three new markets that year.",
    code: `export function protectSentenceStart(text: string): string {
  return text.replace(/([.!?])\\s+(\\w+)\\s+/g, "$1 $2\\u00A0");
}`,
  },
  {
    name: "Sentence-End Protection",
    description:
      "Prevent short words (1\u20133 chars) from sitting alone before a period. Binds them to the preceding word.",
    before:
      "The whole team contributed to it. Nobody could believe we built this from nothing at all.",
    after:
      "The whole team contributed to\u00A0it. Nobody could believe we built this from nothing at\u00A0all.",
    code: `export function protectSentenceEnd(text: string): string {
  return text.replace(/\\s+(\\w{1,3})([.!?])/g, "\\u00A0$1$2");
}`,
  },
  {
    name: "Rag Smoothing",
    description:
      "Evens out line lengths so the right edge forms a smooth shape instead of alternating long and short lines.",
    before:
      "She studied visual communication design at NSCAD and her thesis explored how rhetorical tropes shape meaning in public health campaigns.",
    after:
      "She studied visual communication\u00A0design at NSCAD and her thesis explored\u00A0how rhetorical tropes shape meaning\u00A0in public health campaigns.",
    code: `export function smoothRag(text: string, target = 65): string {
  const words = text.split(" ");
  let len = 0;
  const out: string[] = [];
  for (const w of words) {
    if (len > 0 && len + w.length + 1 > target) {
      out.push("\\u00A0" + w);
      len = w.length;
    } else {
      out.push((len > 0 ? " " : "") + w);
      len += w.length + (len > 0 ? 1 : 0);
    }
  }
  return out.join("");
}`,
  },
  {
    name: "Short Word Binding",
    description:
      "Binds prepositions, articles, and conjunctions (a, an, the, in, on, at, to, by, of) to their neighbors so they never sit alone at a line break.",
    before:
      "He drove through the center of the city and turned onto a narrow street that led to the waterfront.",
    after:
      "He drove through the center of\u00A0the city and turned onto a\u00A0narrow street that led to\u00A0the waterfront.",
    code: `export function bindShortWords(text: string): string {
  return text.replace(
    /\\s(a|an|the|in|on|at|to|by|of|or)\\s/gi,
    (m, w) => \` \${w}\\u00A0\`
  );
}`,
  },
];
