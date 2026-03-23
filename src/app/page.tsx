import { rules } from "./rules-data";
import CodeBlock from "@/components/CodeBlock";
import CopyButton from "@/components/CopyButton";
import AnimatedHeroHeading from "@/components/AnimatedHeroHeading";

import { readFileSync } from "fs";
import path from "path";

const SAMPLE_TEXT =
  "Good typography is invisible. Great typography speaks to the reader without ever being noticed. It carries meaning through form, guides the eye with rhythm, and turns raw content into something worth\u00A0reading.";

const typesetFullCode = (() => {
  try {
    return readFileSync(path.join(process.cwd(), "src/lib/typeset.ts"), "utf-8");
  } catch {
    return "// typeset.ts — see source repository";
  }
})();



const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Montserrat:wght@400;700",
    "family=Lora:wght@400;700",
    "family=Plus+Jakarta+Sans:wght@400;700",
    "family=Inter:wght@400;700",
    "family=Inter+Tight:wght@400;700",
    "family=Poppins:wght@400;700",
    "family=Raleway:wght@400;700",
    "family=Roboto:wght@400;700",
    "family=Roboto+Slab:wght@400;700",
    "family=Roboto+Mono:wght@400;700",
    "family=Open+Sans:wght@400;700",
    "family=Open+Sans+Condensed:wght@300;700",
    "family=Fira+Sans:wght@400;700",
    "family=Outfit:wght@400;700",
    "family=Lexend:wght@400;700",
    "family=DM+Sans:wght@400;700",
    "family=Lato:wght@400;700",
    "family=EB+Garamond:wght@400;700",
    "family=Playfair+Display:wght@400;700",
    "family=Source+Sans+3:wght@400;700",
    "family=DM+Serif+Display:wght@400",
    "family=Nunito:wght@400;700",
    "family=Instrument+Serif:wght@400",
    "family=Lancelot",
    "family=La+Belle+Aurore",
    "family=Cinzel:wght@400;700",
    "family=Quattrocento:wght@400;700",
    "family=Cormorant+Garamond:wght@400;700",
    "family=Fraunces:wght@400;700",
    "family=Alice",
    "family=Great+Vibes",
    "family=Merriweather:wght@400;700",
    "family=Bebas+Neue",
    "family=Space+Grotesk:wght@400;700",
    "family=JetBrains+Mono:wght@400;700",
    "family=Oswald:wght@400;700",
    "family=League+Spartan:wght@400;700",
    "family=Libre+Baskerville:wght@400;700",
    "family=Orbitron:wght@400;700",
    "family=UnifrakturCook:wght@700",
    "family=Podkova:wght@400;700",
    "family=Bungee",
    "family=Bricolage+Grotesque:wght@400;700",
    "family=Pacifico",
    "family=Quicksand:wght@400;700",
    "family=Fredoka:wght@400;700",
    "family=Margarine",
    "family=Inspiration",
    "family=Sacramento",
    "family=Yellowtail",
    "family=Coustard:wght@400;900",
    "family=Fredericka+the+Great",
    "family=Arapey:wght@400",
    "family=Homemade+Apple",
    "family=Borel",
    "family=Bodoni+Moda:wght@400;700",
    "family=Agbalumo",
    "family=Amatic+SC:wght@400;700",
    "family=Beth+Ellen",
    "family=Briem+Hand:wght@400;700",
    "family=Cedarville+Cursive",
    "family=Roboto+Flex:opsz,slnt,wdth,wght,GRAD,XTRA,YOPQ,YTAS,YTDE,YTFI,YTLC,YTUC@8..144,-10..0,25..151,100..1000,-200..150,323..603,25..135,649..854,-305..-98,560..788,416..570,528..760",
  ].join("&") +
  "&display=swap";

type FontPairing = {
  heading: string;
  body: string;
  headingFamily: string;
  bodyFamily: string;
  description: string;
  css: string;
};

type PairingCategory = {
  name: string;
  pairings: FontPairing[];
};

function p(heading: string, hFam: string, body: string, bFam: string, description: string): FontPairing {
  return {
    heading,
    body,
    headingFamily: `'${heading}', ${hFam}`,
    bodyFamily: `'${body}', ${bFam}`,
    description,
    css: `font-family: '${heading}', ${hFam}; /* Headings */\nfont-family: '${body}', ${bFam}; /* Body */`,
  };
}

const pairingCategories: PairingCategory[] = [
  {
    name: "Clean, Modern & Minimalist",
    pairings: [
      p("Montserrat", "sans-serif", "Lora", "serif", "Clean, confident sans-serif heading balanced by warmth of elegant serif"),
      p("Plus Jakarta Sans", "sans-serif", "Inter", "sans-serif", "Geometric perfection meets global scalability"),
      p("Poppins", "sans-serif", "Inter", "sans-serif", "Upbeat friendly energy balanced with serious contemporary undertone"),
      p("Roboto", "sans-serif", "Raleway", "sans-serif", "Structured mechanical feel softened by airy elongated strokes"),
      p("Open Sans", "sans-serif", "Open Sans Condensed", "sans-serif", "Signature contrast within same typeface family"),
      p("Fira Sans", "sans-serif", "Montserrat", "sans-serif", "Harmonious balance of modernity and elegance"),
      p("Outfit", "sans-serif", "Lexend", "sans-serif", "Highly legible pairing focused on accessibility and cognitive load reduction"),
      p("Montserrat", "sans-serif", "DM Sans", "sans-serif", "High-impact agency aesthetic balancing visual strength with organic flow"),
      p("Lato", "sans-serif", "EB Garamond", "serif", "Simple modern sans-serif matched with soft classic serif"),
      p("Roboto", "sans-serif", "Roboto Slab", "serif", "Matching family pairing sharing rhythm and spacing"),
      p("Raleway", "sans-serif", "Open Sans", "sans-serif", "Refined style headers with high usability body text"),
    ],
  },
  {
    name: "Elegant, Sophisticated & Editorial",
    pairings: [
      p("Playfair Display", "serif", "Source Sans 3", "sans-serif", "High-contrast classic serif with minimal sans-serif body"),
      p("DM Serif Display", "serif", "Nunito", "sans-serif", "Romantic sophistication balanced by ultra-clean readability"),
      p("Instrument Serif", "serif", "Inter Tight", "sans-serif", "Silent luxury aesthetic with Apple-inspired minimalism"),
      p("Lancelot", "serif", "La Belle Aurore", "cursive", "Elegant serifs merged with delicate graceful script"),
      p("Playfair Display", "serif", "Lora", "serif", "18th-century styling with organic strokes for upscale brands"),
      p("Cinzel", "serif", "Quattrocento", "serif", "Classic Roman typography with strong vertical lines"),
      p("Cormorant Garamond", "serif", "Nunito", "sans-serif", "High-end organic serif with gentle rounded sans-serif"),
      p("Fraunces", "serif", "DM Sans", "sans-serif", "Soft serifs with warm tones for boutique lifestyle"),
      p("Playfair Display", "serif", "Alice", "serif", "Bold serif authority with whimsical character"),
      p("Great Vibes", "cursive", "Merriweather", "serif", "Delicate romantic script loops anchored by balanced readable serifs"),
    ],
  },
  {
    name: "Bold, Edgy & High-Impact",
    pairings: [
      p("Bebas Neue", "sans-serif", "Roboto Mono", "monospace", "Aggressive sans-serif synergizing with engineered monospace"),
      p("Space Grotesk", "sans-serif", "JetBrains Mono", "monospace", "Radical innovation for developer ecosystems"),
      p("Oswald", "sans-serif", "Courier New", "monospace", "Hard-hitting verticality with vintage attitude"),
      p("League Spartan", "sans-serif", "Libre Baskerville", "serif", "Strong structured geometric heading with elegantly curved serifs"),
      p("Bebas Neue", "sans-serif", "Poppins", "sans-serif", "Dominant urgency evened out by smooth circular proportions"),
      p("Orbitron", "sans-serif", "Roboto", "sans-serif", "Mechanical space-age aesthetic softened by user-friendly letterforms"),
      p("UnifrakturCook", "serif", "Podkova", "serif", "Bold blackletter authority with ultra-cool modern look"),
      p("Bungee", "sans-serif", "Bricolage Grotesque", "sans-serif", "Energetic display personality grounded by versatile sans-serif"),
    ],
  },
  {
    name: "Playful, Friendly & Creative",
    pairings: [
      p("Pacifico", "cursive", "Quicksand", "sans-serif", "Flamboyant brush font with rounded quirky sans-serif"),
      p("Fredoka", "sans-serif", "Nunito", "sans-serif", "Oversized rounded letters with youthful exuberance"),
      p("Poppins", "sans-serif", "Merriweather", "serif", "Rounded approachable sans-serif with traditional serif hierarchy"),
      p("Sacramento", "cursive", "Playfair Display", "serif", "Unique elegant calligraphy with classic refined serif"),
      p("Yellowtail", "cursive", "Open Sans", "sans-serif", "Playful fat-brush display font with highly readable typeface"),
      p("Coustard", "serif", "Fredericka the Great", "serif", "Dependable clean slab serif with hand-drawn quirky twist"),
      p("Arapey", "serif", "Homemade Apple", "cursive", "Classic serif charm with approachable organic casual script"),
      p("Borel", "cursive", "Bodoni Moda", "serif", "Playful handcrafted header anchored by sleek sharp serif"),
      p("Agbalumo", "sans-serif", "Nunito", "sans-serif", "Thick expressive letterforms balanced by soft rounded readability"),
      p("Beth Ellen", "cursive", "Libre Baskerville", "serif", "Casual ink-drawn rhythm paired with timeless precision"),
      p("Briem Hand", "cursive", "Cedarville Cursive", "cursive", "Confident human strokes with flowing emotional cursive"),
    ],
  },
];

const tips = [
  {
    title: "Line Height",
    content:
      "Body text reads best at 1.5\u00A0to\u00A01.7. Headings can sit tighter\u00A0\u2014 around 1.1\u00A0to\u00A01.3. Never leave body copy at the browser default\u00A0of\u00A01.2.",
    code: `body { line-height: 1.6; }\nh1, h2, h3 { line-height: 1.15; }`,
  },
  {
    title: "Measure (Line Length)",
    content:
      "The ideal line length is 45\u00A0to\u00A075 characters. Too wide and the eye loses its place; too narrow and the rhythm breaks with constant\u00A0returns.",
    code: `p { max-width: 65ch; }`,
  },
  {
    title: "Vertical Rhythm",
    content:
      "Pick a base unit\u00A0\u2014 say 1.5\u00A0rem\u00A0\u2014 and derive all spacing from it. When margins, padding, and leading share a common measure, the page finds its\u00A0harmony.",
    code: `:root { --rhythm: 1.5rem; }\np { margin-bottom: var(--rhythm); }\nh2 { margin-top: calc(var(--rhythm) * 2); }`,
  },
  {
    title: "Responsive Type Scales",
    content:
      "Use clamp() for fluid type that scales between breakpoints. No jagged media-query jumps\u00A0\u2014 just smooth, steady\u00A0scaling.",
    code: `h1 { font-size: clamp(2rem, 5vw + 1rem, 4.5rem); }\np  { font-size: clamp(1rem, 1vw + 0.75rem, 1.25rem); }`,
  },
  {
    title: "text-wrap: balance and pretty",
    content:
      "CSS now offers native wrapping control. Use \u2018balance\u2019 on headings to even out line lengths, and \u2018pretty\u2019 on body text to prevent\u00A0orphans.",
    code: `h1, h2, h3 { text-wrap: balance; }\np { text-wrap: pretty; }`,
  },
  {
    title: "font-feature-settings",
    content:
      "Unlock hidden type features: ligatures smooth letter joins, oldstyle numerals blend into running text, and tabular figures keep columns\u00A0aligned.",
    code: `body {\n  font-feature-settings: "liga" 1, "calt" 1;\n}\n.body-numerals {\n  font-feature-settings: "onum" 1;\n}\n.table-numerals {\n  font-feature-settings: "tnum" 1;\n}`,
  },
  {
    title: "Orphans and Widows",
    content:
      "CSS orphans and widows set how many lines sit at the top and bottom of page breaks. On the web, pair them with text-wrap:\u00A0pretty and tools like\u00A0typeset.ts.",
    code: `p {\n  orphans: 2;\n  widows: 2;\n  text-wrap: pretty;\n}`,
  },
  {
    title: "Optical Margin Alignment",
    content:
      "Letters like T, V, W and quote marks create false indents. The hanging-punctuation property aligns text to the optical edge, not the\u00A0metric\u00A0one.",
    code: `p {\n  hanging-punctuation: first last;\n}\nblockquote {\n  hanging-punctuation: first;\n}`,
  },
];

export default function Home() {
  const totalPairings = pairingCategories.reduce((n, c) => n + c.pairings.length, 0);

  return (
    <main className="min-h-screen relative" style={{ zIndex: 2 }}>
      {/* Google Fonts for all 36 pairings */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={GOOGLE_FONTS_URL} />
      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center pt-8 sm:pt-12 lg:pt-[12vh] min-h-[85vh] px-4 sm:px-6 text-center mb-4 bg-black/65 backdrop-blur-sm mx-3 sm:mx-6 lg:mx-12">
        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-[#B8963E] mb-8">
          A resource for designers and developers
        </p>
        <AnimatedHeroHeading />
        <p
          data-no-typeset
          className="max-w-xl text-base sm:text-lg text-neutral-400 leading-relaxed mt-6 lg:mt-16"
          style={{ fontFamily: "var(--font-source-sans)", textWrap: "balance" }}
        >
          Typography is the foundation of great&nbsp;design.
          <br />
          It shapes how we read, how we feel, and how we&nbsp;understand.
          <br />
          This is a practical guide to getting it right on the&nbsp;web.
        </p>
        <div className="mt-auto pt-8 lg:pt-12 pb-8 flex flex-wrap justify-center gap-3 text-xs font-mono uppercase tracking-widest text-neutral-600">
          <a href="#rules" className="border border-neutral-800 px-4 py-2 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors">Rules</a>
          <a href="#pairings" className="border border-neutral-800 px-4 py-2 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors">Pairings</a>
          <a href="#tips" className="border border-neutral-800 px-4 py-2 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors">Tips</a>
          <a href="#utility" className="border border-neutral-800 px-4 py-2 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors">Utility</a>
        </div>
        </div>
      </section>

      {/* ── Content area — transparent wrapper, each section gets its own dark box ── */}
      <div className="relative">

      {/* ── Typographic Rules ── */}
      <section id="rules" className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-24 my-4 bg-black/65 backdrop-blur-sm mx-3 sm:mx-6 lg:mx-12">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
          01 -- Typographic Rules
        </p>
        <h2
          className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Clean Text, Automatically
        </h2>
        <p className="text-sm sm:text-base text-neutral-400 max-w-2xl mb-8 sm:mb-16 leading-relaxed" style={{ fontFamily: "var(--font-source-sans)", textWrap: "pretty" }}>
          Five rules that turn raw text into clean, well-set copy. Each uses
          non-breaking spaces to control line breaks without changing your&nbsp;content.
        </p>

        <div className="space-y-12">
          {rules.map((rule) => (
            <div
              key={rule.name}
              className="border border-neutral-800 bg-neutral-950/30"
              style={{ borderRadius: 0 }}
            >
              <div className="p-4 sm:p-6 lg:p-8 border-b border-neutral-800">
                <div className="flex items-start justify-between mb-4">
                  <h3
                    className="text-xl sm:text-2xl font-bold tracking-tight"
                    style={{ fontFamily: "var(--font-playfair)" }}
                  >
                    {rule.name}
                  </h3>
                </div>
                <p className="text-sm sm:text-base text-neutral-400 leading-relaxed mb-6 max-w-2xl" style={{ fontFamily: "var(--font-source-sans)", textWrap: "pretty" as never }}>
                  {rule.description}
                </p>

                <div className="space-y-4 mb-8">
                  <div className="border border-red-900/40 bg-red-950/10 overflow-hidden">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-red-400/50 px-6 pt-5 pb-1">
                      Default
                    </p>
                    <div className="px-6 py-6">
                      <img
                        src={`/examples/${rule.id}-before.png?v=4`}
                        alt="Default browser rendering"
                        className="w-full"
                        style={{ borderRadius: 0 }}
                      />
                    </div>
                  </div>
                  <div className="border border-emerald-900/40 bg-emerald-950/10 overflow-hidden">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/50 px-6 pt-5 pb-1">
                      With typeset
                    </p>
                    <div className="px-6 py-6">
                      <img
                        src={`/examples/${rule.id}-after.png?v=4`}
                        alt="With typeset applied"
                        className="w-full"
                        style={{ borderRadius: 0 }}
                      />
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
      <section id="pairings" className="my-4 bg-black/65 backdrop-blur-sm mx-3 sm:mx-6 lg:mx-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            02 -- Font Pairings
          </p>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Curated Combinations
          </h2>
          <p className="text-sm sm:text-base text-neutral-400 max-w-2xl mb-8 sm:mb-16 leading-relaxed" style={{ fontFamily: "'Source Sans 3', sans-serif", textWrap: "pretty" }}>
            {totalPairings} curated font pairings, all loaded from Google Fonts.
            Each one is shown with a live preview — copy the CSS and use it&nbsp;today.
          </p>

          {pairingCategories.map((category) => (
            <div key={category.name} className="mb-16 last:mb-0">
              <h3 className="font-mono text-sm uppercase tracking-[0.25em] text-[#B8963E] border-b border-neutral-800 pb-4 mb-8">
                {category.name}
              </h3>
              <div className="grid gap-8">
                {category.pairings.map((pair) => (
                  <div
                    key={`${pair.heading}-${pair.body}`}
                    className="border border-neutral-800 bg-neutral-950/30"
                    style={{ borderRadius: 0 }}
                  >
                    <div className="p-4 sm:p-6 lg:p-8">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">
                            {category.name}
                          </p>
                          <p className="text-sm text-neutral-300 mt-1">
                            {pair.heading} + {pair.body}
                          </p>
                          <p className="text-xs text-neutral-500 mt-1 italic">
                            {pair.description}
                          </p>
                        </div>
                        <CopyButton text={pair.css} />
                      </div>

                      <h4
                        className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4"
                        style={{ fontFamily: pair.headingFamily }}
                      >
                        The Art of Type
                      </h4>
                      <p
                        className="text-sm sm:text-base text-neutral-400 leading-relaxed max-w-2xl"
                        style={{ fontFamily: pair.bodyFamily }}
                      >
                        {SAMPLE_TEXT}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Typography Tips ── */}
      <section id="tips" className="my-4 bg-black/65 backdrop-blur-sm mx-3 sm:mx-6 lg:mx-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            03 -- Typography Tips
          </p>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            The Details That Matter
          </h2>
          <p className="text-sm sm:text-base text-neutral-400 max-w-2xl mb-8 sm:mb-16 leading-relaxed" style={{ fontFamily: "var(--font-source-sans)", textWrap: "pretty" }}>
            Practical CSS for better reading. Each tip is something you can
            apply to your next project&nbsp;today.
          </p>

          <div className="grid sm:grid-cols-2 gap-8">
            {tips.map((tip) => (
              <div
                key={tip.title}
                className="border border-neutral-800 bg-neutral-950/30 min-w-0 overflow-hidden"
                style={{ borderRadius: 0 }}
              >
                <div className="p-4 sm:p-6 border-b border-neutral-800 min-w-0">
                  <h3
                    className="text-lg sm:text-xl font-bold tracking-tight mb-3"
                    style={{ fontFamily: "var(--font-playfair)" }}
                  >
                    {tip.title}
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed break-words" style={{ fontFamily: "var(--font-source-sans)" }}>
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
      <section id="utility" className="my-4 bg-black/65 backdrop-blur-sm mx-3 sm:mx-6 lg:mx-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            04 -- The Utility
          </p>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            typeset.ts
          </h2>
          <p className="text-sm sm:text-base text-neutral-400 max-w-2xl mb-8 leading-relaxed" style={{ fontFamily: "var(--font-source-sans)", textWrap: "pretty" }}>
            Drop this file into any TypeScript project. Call{" "}
            <code className="font-mono text-[#B8963E]">typeset(text)</code> to
            apply all five rules at once, or use each function on its&nbsp;own.
          </p>

          <CodeBlock code={typesetFullCode} title="typeset.ts" />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="my-4 bg-black/65 backdrop-blur-sm mx-3 sm:mx-6 lg:mx-12 py-12 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">
          Built with care for the craft of typography
        </p>
      </footer>

      </div>{/* end solid bg wrapper */}
    </main>
  );
}
