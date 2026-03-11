export type Rule = {
  name: string;
  description: string;
  id: string;
  code: string;
};

export const rules: Rule[] = [
  {
    name: "No Orphans",
    id: "orphans",
    description:
      "The last word of a paragraph shouldn't sit alone on its own line. Typeset binds it to the word before it.",
    code: `export function preventOrphans(text: string): string {
  const i = text.lastIndexOf(" ");
  if (i === -1) return text;
  return text.slice(0, i) + "\\u00A0" + text.slice(i + 1);
}`,
  },
  {
    name: "Sentence-Start Protection",
    id: "sentence-start",
    description:
      "When a sentence begins near the end of a line, the first word can get stranded alone. Typeset keeps the opening two words of each sentence\u00A0together.",
    code: `export function protectSentenceStart(text: string): string {
  return text.replace(/([.!?])\\s+(\\w+)\\s+/g, "$1 $2\\u00A0");
}`,
  },
  {
    name: "Sentence-End Protection",
    id: "sentence-end",
    description:
      "Short closing words like \u201Cit,\u201D \u201Cto,\u201D and \u201Cso\u201D shouldn\u2019t sit alone at the end of a sentence. Typeset pulls them back to the line\u00A0before.",
    code: `export function protectSentenceEnd(text: string): string {
  return text.replace(/\\s+(\\w{1,3})([.!?])/g, "\\u00A0$1$2");
}`,
  },
  {
    name: "Break Optimization",
    id: "rag",
    description:
      "The browser breaks lines greedily\u00A0\u2014 fill until full, then wrap. This leaves prepositions stranded, articles orphaned, and sentences split mid-thought. Break optimization uses dynamic programming to evaluate every possible configuration, keeping words with their syntactic\u00A0partners.",
    code: `export function optimizeBreaks(el: HTMLElement): void {
  const words = el.textContent.split(/ +/);
  const widths = words.map(w => measure(w));
  // Knuth-Plass DP: find globally optimal breaks
  const breaks = knuthPlass(widths, spaceWidth, containerWidth);
  // Bind words at non-break positions with nbsp
  applyNbspBindings(el, breaks);
}`,
  },
  {
    name: "Short Word Binding",
    id: "short-words",
    description:
      "Words like \u201Cof,\u201D \u201Cin,\u201D \u201Ca,\u201D and \u201Cthe\u201D look wrong stranded at the end of a line. Typeset binds each one to the word that follows, so they always travel\u00A0together.",
    code: `export function bindShortWords(text: string): string {
  return text.replace(
    /\\s(a|an|the|in|on|at|to|by|of|or)\\s/gi,
    (m, w) => \` \${w}\\u00A0\`
  );
}`,
  },
];
