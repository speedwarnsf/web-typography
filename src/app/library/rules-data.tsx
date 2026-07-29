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
      "The browser breaks lines greedily\u00A0\u2014 fill until full, then wrap. This leaves prepositions stranded, articles orphaned, and sentences split mid-thought. The compositor runs a beam search over the break candidates, re-ranks the survivors by rag contour, and freezes the winning lines exactly as\u00A0scored.",
    code: `// The live pipeline behind typeset(el) \u2014 real engine entry points:
const tokens = tokenize(rawTextOf(el), measurer);
const lines = composeParagraph(tokens, widthPx, measureCh, { isHeading });
const shaped = shapeExactLines(lines, measureCh, widthPx, isHeading);
if (finalValidate(shaped, measureCh, isHeading)) {
  renderFrozenLines(el, shaped); // .ts-line spans, verified post-render
}`,
  },
  {
    name: "Short Word Binding",
    id: "short-words",
    description:
      "Words like \u201Cof,\u201D \u201Cin,\u201D \u201Ca,\u201D and \u201Cthe\u201D look wrong stranded at the end of a line. The compositor prices every stranding and keeps these words with what follows wherever the rag can afford it \u2014 at reading measures, that is\u00A0everywhere.",
    code: `export function bindShortWords(text: string): string {
  return text.replace(
    /\\s(a|an|the|in|on|at|to|by|of|or)\\s/gi,
    (m, w) => \` \${w}\\u00A0\`
  );
}`,
  },
];
