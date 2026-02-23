// Before: plain text, browser wraps naturally.
// After: same text with \u00A0 non-breaking spaces inserted by typeset rules.
// The rules themselves change where lines break. No manufactured line breaks.

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
      "The last word of a paragraph shouldn't sit alone on its own line. Typeset binds it to the word before it.",
    before:
      "We opened the new location on March 15th and the response from the community was overwhelming.",
    after:
      "We opened the new location on March 15th and the response from the community was\u00A0overwhelming.",
    code: `export function preventOrphans(text: string): string {
  const i = text.lastIndexOf(" ");
  if (i === -1) return text;
  return text.slice(0, i) + "\\u00A0" + text.slice(i + 1);
}`,
  },
  {
    name: "Sentence-Start Protection",
    description:
      "When a new sentence starts near the end of a line, the first word can get stranded alone. Typeset keeps the first two words of a sentence together.",
    before:
      "The project took six months. It was worth every late night and weekend we put into it.",
    after:
      "The project took six months. It\u00A0was worth every late night and weekend we put into\u00A0it.",
    code: `export function protectSentenceStart(text: string): string {
  return text.replace(/([.!?])\\s+(\\w+)\\s+/g, "$1 $2\\u00A0");
}`,
  },
  {
    name: "Sentence-End Protection",
    description:
      "Short words like \"it\" \"to\" and \"so\" shouldn't dangle at the end of a sentence on their own line. They get pulled back to the previous line.",
    before:
      "Everyone on the team agreed it was the right call. We had been working toward this goal for years and we finally got to it.",
    after:
      "Everyone on the team agreed it was the right call. We\u00A0had been working toward this goal for years and we finally got to\u00A0it.",
    code: `export function protectSentenceEnd(text: string): string {
  return text.replace(/\\s+(\\w{1,3})([.!?])/g, "\\u00A0$1$2");
}`,
  },
  {
    name: "Rag Smoothing",
    description:
      "Without rag control, line lengths vary wildly \u2014 one line fills the column, the next has two words. Smoothing creates even line lengths for a cleaner right edge.",
    before:
      "The building was designed by a small firm from Portland that specialized in sustainable architecture using reclaimed materials.",
    after:
      "The building was designed by a small firm from Portland that specialized in sustainable architecture using reclaimed\u00A0materials.",
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
      "Prepositions and articles like \"of\" \"in\" \"a\" and \"the\" look wrong sitting alone at the end of a line. Typeset binds them to the next word so they always travel together.",
    before:
      "She walked through the center of town and stopped at the old bookshop on the corner to browse.",
    after:
      "She walked through the center of\u00A0town and stopped at\u00A0the old bookshop on\u00A0the corner to\u00A0browse.",
    code: `export function bindShortWords(text: string): string {
  return text.replace(
    /\\s(a|an|the|in|on|at|to|by|of|or)\\s/gi,
    (m, w) => \` \${w}\\u00A0\`
  );
}`,
  },
];
