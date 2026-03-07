import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Typeset.us",
  description:
    "Typography is not decoration. It is the invisible architecture of meaning. The story of why Typeset.us exists, told through 30 years of professional practice.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-neutral-200">
      {/* Header */}
      <header className="max-w-4xl mx-auto px-6 pt-24 pb-16 border-b border-neutral-800">
        <p
          className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-8"
          style={{ borderRadius: 0 }}
        >
          About
        </p>
        <div className="flex items-center gap-5">
          <img
            src="/dustin-york.jpg"
            srcSet="/dustin-york.jpg 1x, /dustin-york@2x.jpg 2x"
            alt="Dustin York"
            className="w-16 h-16 rounded-full object-cover shrink-0"
          />
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-playfair)",
                lineHeight: 1.2,
              }}
            >
              Dustin York, <span className="font-normal">BDes</span>
            </h1>
            <p
              className="text-lg text-neutral-400 mt-1"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              Communication Designer
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <article className="max-w-4xl mx-auto px-6 py-16">
        <div
          className="prose prose-invert max-w-none"
          style={{
            fontFamily: "var(--font-source-sans)",
            fontSize: "1.125rem",
            lineHeight: 1.75,
            color: "#d4d4d4",
          }}
        >
          <div style={{ maxWidth: "65ch", textWrap: "pretty" }}>
            <p className="text-lg leading-[1.8] mb-8">
              Typography is not decoration. It is the invisible architecture of
              meaning — the difference between words that are read and words
              that are felt. Typeset.us exists because that difference matters.
            </p>

            <h2
              className="text-2xl font-bold mt-16 mb-6 text-neutral-100"
              style={{
                fontFamily: "var(--font-playfair)",
                lineHeight: 1.3,
                textWrap: "balance",
              }}
            >
              The Foundation
            </h2>
            <p className="leading-[1.8] mb-6">
              Dustin York studied Communication Design (Honors) at the Nova
              Scotia College of Art and Design (NSCAD), where he was mentored
              by Peter Brooks and studied under Hanno Ehses. The program
              centered on rhetoric and the use of its tropes in visual
              communication — the idea that design choices carry persuasive
              meaning beyond their literal function. His thesis applied these
              principles to typography on the web. The right typeface does not
              announce itself — but the rhetorical choices behind it are
              deliberate, discoverable, and worth understanding.
            </p>

            <h2
              className="text-2xl font-bold mt-16 mb-6 text-neutral-100"
              style={{
                fontFamily: "var(--font-playfair)",
                lineHeight: 1.3,
                textWrap: "balance",
              }}
            >
              The Practice
            </h2>
            <p className="leading-[1.8] mb-6">
              For more than 30 years, York has worked as an Art Director at
              Better World Advertising, a studio that exclusively creates
              campaigns for social good — HIV/STD prevention, anti-tobacco
              initiatives, LGBTQ+ rights, mental health awareness, foster care
              advocacy, environmental protection. In this work, typography is
              not aesthetic preference. It is ethical responsibility. The wrong
              typeface on a healthcare campaign does not just look bad — it
              erodes trust. The right one can save a life by making critical
              information feel credible and accessible.
            </p>

            <h2
              className="text-2xl font-bold mt-16 mb-6 text-neutral-100"
              style={{
                fontFamily: "var(--font-playfair)",
                lineHeight: 1.3,
                textWrap: "balance",
              }}
            >
              The Tool
            </h2>
            <p className="leading-[1.8] mb-6">
              Typeset.us is the distillation of three decades spent caring
              about the details that most people never notice: the orphan at
              the end of a paragraph, the rag that disrupts reading flow, the
              short word stranded alone at the edge of a line. These are small
              things. They are also the difference between text that is merely
              displayed and text that is truly set.
            </p>
            <p className="leading-[1.8] mb-6">
              The web has never had professional typography. Browsers render
              text with the same indifference they brought to the medium in
              1995. Typeset.us changes that — one line of code, one tool at a
              time.
            </p>

            <h2
              className="text-2xl font-bold mt-16 mb-6 text-neutral-100"
              style={{
                fontFamily: "var(--font-playfair)",
                lineHeight: 1.3,
                textWrap: "balance",
              }}
            >
              The Craft
            </h2>
            <p className="leading-[1.8] mb-8">
              This is a resource built by someone who has spent a career
              believing that how we say something matters as much as what we
              say. Typography is the craft of making language visible. This
              site is an attempt to make that craft accessible to everyone who
              puts words on screens.
            </p>
          </div>
        </div>

        {/* Credentials */}
        <aside className="mt-20 pt-12 border-t border-neutral-800">
          <div
            className="border border-neutral-800 bg-neutral-950/50 p-8"
            style={{ borderRadius: 0, maxWidth: "65ch" }}
          >
            <p
              className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#B8963E] mb-6"
              style={{ borderRadius: 0 }}
            >
              Credentials
            </p>
            <ul
              className="space-y-3 text-neutral-300"
              style={{ fontFamily: "var(--font-source-sans)", fontSize: "1rem" }}
            >
              <li className="flex flex-col sm:flex-row sm:gap-3">
                <span className="font-bold text-neutral-100 min-w-[200px]">
                  Education
                </span>
                <span className="text-neutral-400">
                  NSCAD — Communication Design Honors
                </span>
              </li>
              <li className="flex flex-col sm:flex-row sm:gap-3">
                <span className="font-bold text-neutral-100 min-w-[200px]">
                  Practice
                </span>
                <span className="text-neutral-400">30+ years professional</span>
              </li>
              <li className="flex flex-col sm:flex-row sm:gap-3">
                <span className="font-bold text-neutral-100 min-w-[200px]">
                  Position
                </span>
                <span className="text-neutral-400">
                  Art Director, Better World Advertising
                </span>
              </li>
              <li className="flex flex-col sm:flex-row sm:gap-3">
                <span className="font-bold text-neutral-100 min-w-[200px]">
                  Specialization
                </span>
                <span className="text-neutral-400">
                  Social marketing, public health, human rights campaigns
                </span>
              </li>
            </ul>
          </div>
        </aside>

        {/* Links */}
        <nav className="mt-16 flex flex-wrap gap-6">
          <a
            href="/"
            className="font-mono text-sm uppercase tracking-[0.25em] text-[#B8963E] hover:text-[#d4b158] transition-colors border-b border-[#B8963E] hover:border-[#d4b158] pb-1"
            style={{ borderRadius: 0 }}
          >
            Back to Tools
          </a>
          <a
            href="#donate"
            className="font-mono text-sm uppercase tracking-[0.25em] text-neutral-400 hover:text-neutral-200 transition-colors border-b border-neutral-700 hover:border-neutral-400 pb-1"
            style={{ borderRadius: 0 }}
          >
            Support Typeset
          </a>
        </nav>
      </article>

      {/* Footer */}
      <footer className="border-t border-neutral-800 mt-24 py-12 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">
          Built with care for the craft of typography
        </p>
      </footer>
    </main>
  );
}
