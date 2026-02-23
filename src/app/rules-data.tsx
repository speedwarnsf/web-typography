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
      "When a new sentence starts near the end of a line, the first word can get stranded alone. Typeset keeps the first two words of a sentence together.",
    code: `export function protectSentenceStart(text: string): string {
  return text.replace(/([.!?])\\s+(\\w+)\\s+/g, "$1 $2\\u00A0");
}`,
  },
  {
    name: "Sentence-End Protection",
    id: "sentence-end",
    description:
      "Short words like \"it\" \"to\" and \"so\" shouldn't dangle at the end of a sentence on their own line. They get pulled back to the previous line.",
    code: `export function protectSentenceEnd(text: string): string {
  return text.replace(/\\s+(\\w{1,3})([.!?])/g, "\\u00A0$1$2");
}`,
  },
  {
    name: "Rag Smoothing",
    id: "rag",
    description:
      "Without rag control, line lengths vary wildly \u2014 one line barely reaches half the column while the next fills it completely. Smoothing adjusts word-spacing line by line, gently extending short lines and tightening long ones to create a cleaner right edge.",
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
      "Prepositions and articles like \"of\" \"in\" \"a\" and \"the\" look wrong sitting alone at the end of a line. Typeset binds them to the next word so they always travel together.",
    code: `export function bindShortWords(text: string): string {
  return text.replace(
    /\\s(a|an|the|in|on|at|to|by|of|or)\\s/gi,
    (m, w) => \` \${w}\\u00A0\`
  );
}`,
  },
];
