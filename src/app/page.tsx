import CodeBlock from "@/components/CodeBlock";
import CopyButton from "@/components/CopyButton";
import { readFileSync } from "fs";
import path from "path";

const SAMPLE_TEXT =
  "Good typography is invisible. Great typography speaks to the reader without ever being noticed. It carries meaning through form, guides the eye with rhythm, and transforms raw content into an experience worth having.";

const typesetFullCode = (() => {
  try {
    return readFileSync(path.join(process.cwd(), "src/lib/typeset.ts"), "utf-8");
  } catch {
    return "// typeset.ts — see source repository";
  }
})();

const rules = [
  {
    name: "No Orphans",
    description:
      "Replace the last space in a paragraph with a non-breaking space, ensuring the final line always contains at least two words. Prevents lonely words dangling on their own line.",
    beforeLines: ["Good typography is invisible.", "Great typography speaks", "without ever being", { text: "noticed.", highlight: true }],
    afterLines: ["Good typography is invisible.", "Great typography speaks", "without ever", { text: "being noticed.", highlight: true }],
    code: `export function preventOrphans(text: string): string {
  const lastSpaceIndex = text.lastIndexOf(" ");
  if (lastSpaceIndex === -1) return text;
  return (
    text.slice(0, lastSpaceIndex) + "\\u00A0" + text.slice(lastSpaceIndex + 1)
  );
}`,
  },
  {
    name: "Sentence-Start Protection",
    description:
      "Bind the first two words after a sentence boundary so a line never begins with just one word from the new sentence. Keeps the reading flow unbroken.",
    beforeLines: ["The type was set well.", { text: "She", highlight: true }, "noticed it immediately."],
    afterLines: ["The type was set well.", { text: "She noticed", highlight: true }, "it immediately."],
    code: `export function protectSentenceStart(text: string): string {
  return text.replace(/([.!?])\\s+(\\w+)\\s+/g, "$1 $2\\u00A0");
}`,
  },
  {
    name: "Sentence-End Protection",
    description:
      "Prevent short words (1-3 characters) from sitting alone at the end of a sentence. Binds them to the preceding word with a non-breaking space.",
    beforeLines: ["The details are what separate", "good work from great. Every", "decision you make adds to", { text: "it.", highlight: true }],
    afterLines: ["The details are what separate", "good work from great. Every", "decision you make", { text: "adds to it.", highlight: true }],
    code: `export function protectSentenceEnd(text: string): string {
  return text.replace(/\\s+(\\w{1,3})([.!?])/g, "\\u00A0$1$2");
}`,
  },
  {
    name: "Rag Smoothing",
    description:
      "Detects words that would push a line past the target length and binds them to the previous word, pulling them to the next line. Creates a smoother right edge without justification.",
    beforeLines: [{ text: "Every choice you make in", highlight: true }, "typography either helps the", { text: "reader or gets in their", highlight: true }, "way."],
    afterLines: ["Every choice you make", "in typography either helps", "the reader or gets", "in their way."],
    code: `export function smoothRag(text: string, targetLineLength = 65): string {
  const words = text.split(" ");
  let currentLength = 0;
  const result: string[] = [];

  for (const word of words) {
    if (currentLength > 0 && currentLength + word.length + 1 > targetLineLength) {
      result.push("\\u00A0" + word);
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
}`,
  },
  {
    name: "Short Word Binding",
    description:
      "Common prepositions, articles, and conjunctions (a, an, the, in, on, at, to, by, of, etc.) are bound to the following word with a non-breaking space. Prevents these small words from ending a line alone.",
    beforeLines: [{ text: "She walked to", highlight: true }, "the store and stood in", "the rain for a while."],
    afterLines: [{ text: "She walked to the store", highlight: true }, "and stood in the rain", "for a while."],
    code: `export function bindShortWords(text: string): string {
  return text.replace(
    /\\s(a|an|the|in|on|at|to|by|of|or|is|it|as|if|so|no|do|up|we|he|me|my|be|am)\\s/gi,
    (match, word) => \` \${word}\\u00A0\`
  );
}`,
  },
];

const fontPairings = [
  {
    heading: "Playfair Display",
    body: "Source Sans Pro",
    headingVar: "var(--font-playfair)",
    bodyVar: "var(--font-source-sans)",
    vibe: "Editorial",
    css: `font-family: 'Playfair Display', serif; /* Headings */\nfont-family: 'Source Sans 3', sans-serif; /* Body */`,
  },
  {
    heading: "Inter",
    body: "Lora",
    headingVar: "var(--font-inter)",
    bodyVar: "var(--font-lora)",
    vibe: "Modern Editorial",
    css: `font-family: 'Inter', sans-serif; /* Headings */\nfont-family: 'Lora', serif; /* Body */`,
  },
  {
    heading: "Space Grotesk",
    body: "Crimson Pro",
    headingVar: "var(--font-space-grotesk)",
    bodyVar: "var(--font-crimson-pro)",
    vibe: "Tech Meets Classic",
    css: `font-family: 'Space Grotesk', sans-serif; /* Headings */\nfont-family: 'Crimson Pro', serif; /* Body */`,
  },
  {
    heading: "DM Serif Display",
    body: "DM Sans",
    headingVar: "var(--font-dm-serif)",
    bodyVar: "var(--font-dm-sans)",
    vibe: "Google's Own",
    css: `font-family: 'DM Serif Display', serif; /* Headings */\nfont-family: 'DM Sans', sans-serif; /* Body */`,
  },
  {
    heading: "Cormorant Garamond",
    body: "Fira Sans",
    headingVar: "var(--font-cormorant)",
    bodyVar: "var(--font-fira-sans)",
    vibe: "Luxury",
    css: `font-family: 'Cormorant Garamond', serif; /* Headings */\nfont-family: 'Fira Sans', sans-serif; /* Body */`,
  },
  {
    heading: "Sora",
    body: "Merriweather",
    headingVar: "var(--font-sora)",
    bodyVar: "var(--font-merriweather)",
    vibe: "Startup Meets Tradition",
    css: `font-family: 'Sora', sans-serif; /* Headings */\nfont-family: 'Merriweather', serif; /* Body */`,
  },
  {
    heading: "Libre Baskerville",
    body: "Nunito Sans",
    headingVar: "var(--font-libre-baskerville)",
    bodyVar: "var(--font-nunito-sans)",
    vibe: "Literary",
    css: `font-family: 'Libre Baskerville', serif; /* Headings */\nfont-family: 'Nunito Sans', sans-serif; /* Body */`,
  },
  {
    heading: "Oswald",
    body: "EB Garamond",
    headingVar: "var(--font-oswald)",
    bodyVar: "var(--font-eb-garamond)",
    vibe: "Bold Contrast",
    css: `font-family: 'Oswald', sans-serif; /* Headings */\nfont-family: 'EB Garamond', serif; /* Body */`,
  },
  {
    heading: "Raleway",
    body: "Bitter",
    headingVar: "var(--font-raleway)",
    bodyVar: "var(--font-bitter)",
    vibe: "Clean and Warm",
    css: `font-family: 'Raleway', sans-serif; /* Headings */\nfont-family: 'Bitter', serif; /* Body */`,
  },
  {
    heading: "Work Sans",
    body: "Spectral",
    headingVar: "var(--font-work-sans)",
    bodyVar: "var(--font-spectral)",
    vibe: "Functional Elegance",
    css: `font-family: 'Work Sans', sans-serif; /* Headings */\nfont-family: 'Spectral', serif; /* Body */`,
  },
  {
    heading: "EB Garamond",
    body: "Inter",
    headingVar: "var(--font-eb-garamond)",
    bodyVar: "var(--font-inter)",
    vibe: "Old World, New Clarity",
    css: `font-family: 'EB Garamond', serif; /* Headings */\nfont-family: 'Inter', sans-serif; /* Body */`,
  },
  {
    heading: "Spectral",
    body: "DM Sans",
    headingVar: "var(--font-spectral)",
    bodyVar: "var(--font-dm-sans)",
    vibe: "Refined and Quiet",
    css: `font-family: 'Spectral', serif; /* Headings */\nfont-family: 'DM Sans', sans-serif; /* Body */`,
  },
];

const tips = [
  {
    title: "Line Height",
    content:
      "Body text reads best at 1.5 to 1.7 line-height. Headings can be tighter -- 1.1 to 1.3. Never leave line-height at the browser default of 1.2 for body copy.",
    code: `body { line-height: 1.6; }\nh1, h2, h3 { line-height: 1.15; }`,
  },
  {
    title: "Measure (Line Length)",
    content:
      "The ideal line length for comfortable reading is 45 to 75 characters. Too wide and the eye loses its place; too narrow and the rhythm breaks with constant line returns.",
    code: `p { max-width: 65ch; }`,
  },
  {
    title: "Vertical Rhythm",
    content:
      "Establish a base unit (e.g. 1.5rem) and derive all spacing from it. Margins, padding, and line-heights that share a common denominator create visual harmony.",
    code: `:root { --rhythm: 1.5rem; }\np { margin-bottom: var(--rhythm); }\nh2 { margin-top: calc(var(--rhythm) * 2); }`,
  },
  {
    title: "Responsive Type Scales",
    content:
      "Use clamp() for fluid typography that scales smoothly between breakpoints. No more jagged media-query jumps -- just continuous, proportional scaling.",
    code: `h1 { font-size: clamp(2rem, 5vw + 1rem, 4.5rem); }\np  { font-size: clamp(1rem, 1vw + 0.75rem, 1.25rem); }`,
  },
  {
    title: "text-wrap: balance and pretty",
    content:
      "CSS now supports native text wrapping control. Use 'balance' on headings to even out line lengths, and 'pretty' on body text to avoid orphans. Browser support is growing fast.",
    code: `h1, h2, h3 { text-wrap: balance; }\np { text-wrap: pretty; }`,
  },
  {
    title: "font-feature-settings",
    content:
      "Unlock hidden typographic features: ligatures smooth letter connections, oldstyle numerals blend into body text, and tabular figures align in tables.",
    code: `body {\n  font-feature-settings: "liga" 1, "calt" 1;\n}\n.body-numerals {\n  font-feature-settings: "onum" 1;\n}\n.table-numerals {\n  font-feature-settings: "tnum" 1;\n}`,
  },
  {
    title: "Orphans and Widows",
    content:
      "CSS orphans and widows properties control how many lines appear at the bottom and top of page breaks. For web, combine with text-wrap: pretty and JavaScript solutions like typeset.ts.",
    code: `p {\n  orphans: 2;\n  widows: 2;\n  text-wrap: pretty;\n}`,
  },
  {
    title: "Optical Margin Alignment",
    content:
      "Punctuation and certain letterforms (T, V, W, quotation marks) create visual indentation. hanging-punctuation aligns text to the visual edge rather than the geometric one.",
    code: `p {\n  hanging-punctuation: first last;\n}\nblockquote {\n  hanging-punctuation: first;\n}`,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* ── Hero ── */}
      <section className="flex flex-col items-center justify-center min-h-[85vh] px-6 text-center border-b border-neutral-800">
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-[#B8963E] mb-8">
          A resource for designers and developers
        </p>
        <h1
          className="text-6xl sm:text-8xl md:text-9xl font-bold tracking-tight leading-[0.9] mb-8"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Web<br />Typography
        </h1>
        <p
          className="max-w-xl text-lg text-neutral-400 leading-relaxed"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Typography is the foundation of great design. It shapes how we read,
          how we feel, and how we understand. This is a practical guide to
          getting it right on the web.
        </p>
        <div className="mt-12 flex gap-8 text-xs font-mono uppercase tracking-widest text-neutral-600">
          <a href="#rules" className="hover:text-[#B8963E] transition-colors">Rules</a>
          <a href="#pairings" className="hover:text-[#B8963E] transition-colors">Pairings</a>
          <a href="/pairing-cards" className="hover:text-[#B8963E] transition-colors">Builder</a>
          <a href="/animations" className="hover:text-[#B8963E] transition-colors">Animations</a>
          <a href="#tips" className="hover:text-[#B8963E] transition-colors">Tips</a>
          <a href="#utility" className="hover:text-[#B8963E] transition-colors">Utility</a>
        </div>
      </section>

      {/* ── Typographic Rules ── */}
      <section id="rules" className="max-w-5xl mx-auto px-6 py-24">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
          01 -- Typographic Rules
        </p>
        <h2
          className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Clean Text, Automatically
        </h2>
        <p className="text-neutral-400 max-w-2xl mb-16 leading-relaxed" style={{ fontFamily: "var(--font-source-sans)" }}>
          Five rules that transform raw text into professionally typeset copy.
          Each function uses non-breaking spaces to control line breaks without
          altering content.
        </p>

        <div className="space-y-12">
          {rules.map((rule) => (
            <div
              key={rule.name}
              className="border border-neutral-800 bg-neutral-950/50"
              style={{ borderRadius: 0 }}
            >
              <div className="p-6 sm:p-8 border-b border-neutral-800">
                <div className="flex items-start justify-between mb-4">
                  <h3
                    className="text-2xl font-bold tracking-tight"
                    style={{ fontFamily: "var(--font-playfair)" }}
                  >
                    {rule.name}
                  </h3>
                </div>
                <p className="text-neutral-400 leading-relaxed mb-6" style={{ fontFamily: "var(--font-source-sans)" }}>
                  {rule.description}
                </p>

                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-neutral-900 border border-neutral-800">
                    <p className="text-xs font-mono uppercase tracking-widest text-neutral-600 mb-3">
                      Before
                    </p>
                    <div
                      className="text-[15px] leading-[1.7] text-red-400/40"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                      data-no-typeset
                    >
                      {rule.beforeLines.map((line: any, i: number) => {
                        const text = typeof line === "string" ? line : line.text;
                        const hl = typeof line !== "string" && line.highlight;
                        return (
                          <span key={i}>
                            {hl ? (
                              <span className="text-red-400 bg-red-400/10 px-0.5">{text}</span>
                            ) : text}
                            {i < rule.beforeLines.length - 1 && <br />}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="p-4 bg-neutral-900 border border-neutral-800">
                    <p className="text-xs font-mono uppercase tracking-widest text-neutral-600 mb-3">
                      After
                    </p>
                    <div
                      className="text-[15px] leading-[1.7] text-emerald-400/40"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                      data-no-typeset
                    >
                      {rule.afterLines.map((line: any, i: number) => {
                        const text = typeof line === "string" ? line : line.text;
                        const hl = typeof line !== "string" && line.highlight;
                        return (
                          <span key={i}>
                            {hl ? (
                              <span className="text-emerald-400 bg-emerald-400/10 px-0.5">{text}</span>
                            ) : text}
                            {i < rule.afterLines.length - 1 && <br />}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <CodeBlock code={rule.code} title="TypeScript" />
            </div>
          ))}
        </div>
      </section>

      {/* ── Font Pairings ── */}
      <section id="pairings" className="border-t border-neutral-800">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            02 -- Font Pairings
          </p>
          <h2
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Curated Combinations
          </h2>
          <p className="text-neutral-400 max-w-2xl mb-16 leading-relaxed" style={{ fontFamily: "var(--font-source-sans)" }}>
            {fontPairings.length} handpicked font pairings, all loaded from Google Fonts.
            Each pair is shown with a live preview. Copy the CSS to use them in
            your project.
          </p>

          <div className="grid gap-8">
            {fontPairings.map((pair) => (
              <div
                key={`${pair.heading}-${pair.body}`}
                className="border border-neutral-800 bg-neutral-950/50"
                style={{ borderRadius: 0 }}
              >
                <div className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">
                        {pair.vibe}
                      </p>
                      <p className="text-sm text-neutral-400 mt-1">
                        {pair.heading} + {pair.body}
                      </p>
                    </div>
                    <CopyButton text={pair.css} />
                  </div>

                  <h3
                    className="text-3xl sm:text-4xl font-bold tracking-tight mb-4"
                    style={{ fontFamily: pair.headingVar }}
                  >
                    The Art of Visual Hierarchy
                  </h3>
                  <p
                    className="text-base text-neutral-400 leading-relaxed max-w-2xl"
                    style={{ fontFamily: pair.bodyVar }}
                  >
                    {SAMPLE_TEXT}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Typography Tips ── */}
      <section id="tips" className="border-t border-neutral-800">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            03 -- Typography Tips
          </p>
          <h2
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            The Details That Matter
          </h2>
          <p className="text-neutral-400 max-w-2xl mb-16 leading-relaxed" style={{ fontFamily: "var(--font-source-sans)" }}>
            Practical CSS techniques for better reading experiences. Each tip is
            something you can apply to your next project today.
          </p>

          <div className="grid sm:grid-cols-2 gap-8">
            {tips.map((tip) => (
              <div
                key={tip.title}
                className="border border-neutral-800 bg-neutral-950/50"
                style={{ borderRadius: 0 }}
              >
                <div className="p-6 border-b border-neutral-800">
                  <h3
                    className="text-xl font-bold tracking-tight mb-3"
                    style={{ fontFamily: "var(--font-playfair)" }}
                  >
                    {tip.title}
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed" style={{ fontFamily: "var(--font-source-sans)" }}>
                    {tip.content}
                  </p>
                </div>
                <CodeBlock code={tip.code} title="CSS" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Full Utility ── */}
      <section id="utility" className="border-t border-neutral-800">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            04 -- The Utility
          </p>
          <h2
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            typeset.ts
          </h2>
          <p className="text-neutral-400 max-w-2xl mb-8 leading-relaxed" style={{ fontFamily: "var(--font-source-sans)" }}>
            Drop this single file into any TypeScript project. Call{" "}
            <code className="font-mono text-[#B8963E]">typeset(text)</code> to
            apply all five rules at once, or use individual functions for
            granular control.
          </p>

          <CodeBlock code={typesetFullCode} title="typeset.ts" />

          <div className="mt-8 flex gap-4">
            <CopyButton text={typesetFullCode} />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-neutral-800 py-12 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">
          Built with care for the craft of typography
        </p>
      </footer>
    </main>
  );
}
