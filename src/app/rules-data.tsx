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
    name: "Rag Smoothing",
    id: "rag",
    description:
      "Without rag control, line lengths vary wildly\u00A0\u2014 one line barely reaches half the column while the next fills it. Smoothing adjusts word-spacing line by line, gently extending short lines and tightening long ones for a cleaner right\u00A0edge.",
    code: `export function smoothRag(el: HTMLElement): void {
  const target = el.offsetWidth * 0.93;
  const lines = getLines(el); // detect line breaks via Range API
  lines.forEach((line, i) => {
    if (i === lines.length - 1) return; // leave last line alone
    const gap = target - line.width;
    const spaces = (line.text.match(/ /g) || []).length;
    if (!spaces) return;
    const ws = gap / spaces; // px per word space
    wrapLine(line, \`word-spacing: \${ws.toFixed(2)}px\`);
  });
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
