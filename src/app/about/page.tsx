import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Typeset.us",
  description:
    "Typography governs how language is experienced. The story of why Typeset.us exists, told through 20 years of professional practice.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a]/85 text-neutral-200 overflow-x-hidden">
      {/* Header */}
      <header className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-16 border-b border-neutral-800">
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
            className="w-16 h-16 object-cover shrink-0"
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
      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div
          className="prose prose-invert max-w-none"
          style={{
            fontFamily: "var(--font-source-sans)",
            fontSize: "1.125rem",
            lineHeight: 1.75,
            color: "#d4d4d4",
          }}
        >
          <div style={{ maxWidth: "51ch", textWrap: "pretty" }}>
            <p className="text-lg leading-[1.8] mb-8">
              Typography governs how language is experienced — not just read,
              but understood. For centuries, typographers have refined the
              conventions that make text readable. Typeset.us applies those
              conventions where they have been most neglected — the browser.
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
              Dustin York is an alumnus of the Honors Communication Design
              program at NSCAD, where he studied rhetoric under Hanno Ehses
              and was mentored by Peter Brooks at the Dawson
              Printshop — learning typographic rigor and the art of
              letterpress printing. Ehses pioneered the application of
              classical rhetoric to visual communication, demonstrating that
              the ancient structures of argumentation remain essential tools
              for designers. The program instilled a discipline: design
              choices carry persuasive meaning beyond their literal function.
              Dustin&#39;s thesis extended these principles to typography on
              the web.
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
              For over 20 years, York has served as Art Director at Better
              World Advertising — a studio dedicated exclusively to social
              good. HIV/STD prevention, anti-tobacco initiatives, LGBTQ+
              rights, mental health, foster care, and environmental advocacy.
              In public health communication, typographic decisions are
              consequential. The wrong typeface undermines credibility. The
              right one makes vital information accessible and trustworthy.
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
              Typeset.us addresses what browsers have long neglected: the
              typographic details that separate professionally set text from
              raw output. Orphan control, rag refinement, binding logic,
              measure-aware line composition. These conventions are well
              established in print. On the web, they have been largely absent.
              This project works to close that gap.
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
              Typography is the discipline of making language visible with
              intention. This site is an effort to make that discipline
              available to anyone working with text on screen.
            </p>
          </div>
        </div>

        {/* Credentials */}
        <aside className="mt-20 pt-12 border-t border-neutral-800">
          <div
            className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6 lg:p-8"
            style={{ borderRadius: 0, maxWidth: "51ch" }}
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
                <span className="text-neutral-400">20+ years professional</span>
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
            href="/support"
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
