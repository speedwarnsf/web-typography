// Before/after use pre-wrapped lines at ~38 chars (mobile column).
// "before" shows how browsers break text by default.
// "after" shows the same text with typeset rules applied.
// No highlighting — the line breaks speak for themselves.

export type Rule = {
  name: string;
  description: string;
  beforeLines: string[];
  afterLines: string[];
  code: string;
};

export const rules: Rule[] = [
  {
    name: "No Orphans",
    description:
      "The last word of a paragraph shouldn't sit alone on its own line. Typeset binds it to the word before it.",
    beforeLines: [
      "We opened the new location on",
      "March 15th and the response",
      "from the community was",
      "overwhelming.",
    ],
    afterLines: [
      "We opened the new location on",
      "March 15th and the response",
      "from the community",
      "was overwhelming.",
    ],
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
    beforeLines: [
      "The project took six months.",
      "It",
      "was worth every late night",
      "and weekend we put into it.",
    ],
    afterLines: [
      "The project took six months.",
      "It was",
      "worth every late night and",
      "weekend we put into it.",
    ],
    code: `export function protectSentenceStart(text: string): string {
  return text.replace(/([.!?])\\s+(\\w+)\\s+/g, "$1 $2\\u00A0");
}`,
  },
  {
    name: "Sentence-End Protection",
    description:
      "Short words like \"it\" \"to\" and \"so\" shouldn't dangle at the end of a sentence on their own line. They get pulled back to the previous line.",
    beforeLines: [
      "Everyone on the team agreed",
      "it was the right call. We had",
      "been working toward this goal",
      "for years and finally got",
      "to",
      "it.",
    ],
    afterLines: [
      "Everyone on the team agreed",
      "it was the right call. We had",
      "been working toward this goal",
      "for years and finally",
      "got to it.",
    ],
    code: `export function protectSentenceEnd(text: string): string {
  return text.replace(/\\s+(\\w{1,3})([.!?])/g, "\\u00A0$1$2");
}`,
  },
  {
    name: "Rag Smoothing",
    description:
      "Without rag control, line lengths vary wildly — one line fills the column, the next has two words. Smoothing creates even line lengths for a cleaner right edge.",
    beforeLines: [
      "The building was designed by a small",
      "firm",
      "from Portland that specialized in",
      "sustainable",
      "architecture using reclaimed",
      "materials.",
    ],
    afterLines: [
      "The building was designed",
      "by a small firm from Portland",
      "that specialized in sustainable",
      "architecture using",
      "reclaimed materials.",
    ],
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
    beforeLines: [
      "She walked through the doors of",
      "the gallery and stopped in",
      "front of a painting she had",
      "never seen. It hung at",
      "the far end of",
      "the room.",
    ],
    afterLines: [
      "She walked through the doors",
      "of the gallery and stopped",
      "in front of a painting she",
      "had never seen. It hung",
      "at the far end",
      "of the room.",
    ],
    code: `export function bindShortWords(text: string): string {
  return text.replace(
    /\\s(a|an|the|in|on|at|to|by|of|or)\\s/gi,
    (m, w) => \` \${w}\\u00A0\`
  );
}`,
  },
];
