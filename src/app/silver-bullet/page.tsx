import CodeBlock from "@/components/CodeBlock";

/**
 * The Silver Bullet — hung list markers. Rebuilt around a live, rendered
 * before/after (browser default vs the snippet, on this page, right now)
 * and the customization variables the engine ships. Both demo lists are
 * compact enough that the comparison fits a phone screen whole.
 */

const cssCode = `ul.ts-styled {
  list-style: none !important;
  padding-left: 1.25em !important;
}
ul.ts-styled > li {
  position: relative;
  margin-bottom: 1em !important;
  line-height: inherit !important;
}
ul.ts-styled > li:last-child {
  margin-bottom: 0 !important;
}
ul.ts-styled > li::before {
  content: var(--ts-bullet-content, "\\2022");
  position: absolute;
  left: -1.25em;
  width: 1.25em;
  /* Right-align the marker in the gutter so it sits close to the text */
  text-align: right;
  padding-right: 0.28em;
  box-sizing: border-box;
  font-size: var(--ts-bullet-size, 1.25em);
  color: var(--ts-bullet-color, currentColor);
  /* Lock line-height so the larger glyph can't stretch the baseline */
  line-height: 1;
  /* Nudge down to align with the x-height */
  top: var(--ts-bullet-top, 0.05em);
  opacity: var(--ts-bullet-opacity, 0.8);
}`;

const variablesCode = `/* Customize without editing the snippet — set variables on any list: */
ul.notes  { --ts-bullet-content: "–"; }                             /* dash   */
ul.steps  { --ts-bullet-content: "→"; --ts-bullet-color: #B8963E; } /* arrow  */
ul.brand  { --ts-bullet-content: "▪"; --ts-bullet-color: #B8963E; } /* square */`;

const DEMO_ITEMS = [
  "Markers hang in the gutter, so every line of text shares one clean left edge.",
  "The marker aligns to the x-height instead of floating near the cap line.",
  "Spacing is em-based: change the font size and everything scales with it.",
];

function DemoList({ variant }: { variant?: string }) {
  return (
    <ul className={variant ? `ts-styled sb-${variant}` : undefined} style={{ margin: 0 }}>
      {DEMO_ITEMS.map((item) => (
        <li key={item.slice(0, 18)}>{item}</li>
      ))}
    </ul>
  );
}

export default function SilverBulletPage() {
  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 relative" style={{ zIndex: 2 }}>
      {/* The demo IS the snippet: this page carries the exact CSS it teaches. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        ${cssCode.replace(/ul\.ts-styled/g, ".sb-demo ul.ts-styled")}
        .sb-demo ul { font-family: var(--font-source-sans), sans-serif; font-size: 1rem; line-height: 1.65; color: #c9c9c9; }
        /* Tailwind preflight strips list markers — restore the TRUE browser
           default so the before side is honest. */
        .sb-demo ul:not(.ts-styled) { list-style: disc outside; padding-left: 1.5em; margin: 0; }
        .sb-demo ul:not(.ts-styled) li { margin-bottom: 1em; }
        .sb-demo ul:not(.ts-styled) li:last-child { margin-bottom: 0; }
        .sb-dash { --ts-bullet-content: "–"; }
        .sb-arrow { --ts-bullet-content: "→"; --ts-bullet-color: #B8963E; --ts-bullet-size: 1em; --ts-bullet-top: 0.18em; }
        .sb-square { --ts-bullet-content: "▪"; --ts-bullet-color: #B8963E; --ts-bullet-size: 0.9em; --ts-bullet-top: 0.22em; }
      `,
        }}
      />
      <div className="max-w-4xl mx-auto">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
          The Silver Bullet
        </p>
        <h1
          className="text-4xl sm:text-5xl font-bold tracking-tight mb-8"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Lists, hung like a book hangs them.
        </h1>

        <div
          className="text-lg text-neutral-400 mb-12 space-y-6 leading-relaxed max-w-2xl"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          <p>
            Look at any well-set book or magazine: the marker hangs in the
            margin, sized to the text, sitting exactly on the x-height, a
            breath away from the words it introduces. Browser bullets are
            none of that — oversized, floating near the cap line, a full em
            adrift of their own text.
          </p>
          <p>
            <strong>The Silver Bullet</strong> is one CSS snippet that fixes
            it everywhere: the marker hangs in the gutter, aligns to the
            x-height, and scales with your type because every unit is an{" "}
            <code>em</code>. It ships inside the engine — any list on a page
            running <code>typeset()</code> or go.js gets it automatically.
          </p>
        </div>

        {/* ── Live before/after — real rendering, compact enough for one phone screen ── */}
        <section className="sb-demo mb-16">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-6">
            01 — See it, live
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-neutral-800 border border-neutral-800">
            <div className="bg-[#070707] p-5 sm:p-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400 mb-5">
                Browser default
              </p>
              <DemoList />
            </div>
            <div className="bg-[#070707] p-5 sm:p-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#B8963E] mb-5">
                The Silver Bullet
              </p>
              <DemoList variant="plain" />
            </div>
          </div>
          <p
            data-no-typeset
            className="mt-4 text-sm text-neutral-400 max-w-2xl leading-relaxed"
            style={{ fontFamily: "var(--font-source-sans)", textWrap: "pretty" }}
          >
            Both lists are rendered by your browser right now — same text, same
            font. Compare the markers: their size, their height against the
            first line, and how close they sit to their own text.
          </p>
        </section>

        {/* ── Customization ── */}
        <section className="sb-demo mb-16">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-6">
            02 — Make it yours
          </p>
          <p
            data-no-typeset
            className="text-base text-neutral-400 mb-6 max-w-2xl leading-relaxed"
            style={{ fontFamily: "var(--font-source-sans)", textWrap: "pretty" }}
          >
            Five CSS variables control the marker — glyph, color, size,
            opacity, and vertical position — so brand styling never means
            editing the snippet. These three lists differ only by variables:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-neutral-800 border border-neutral-800 mb-6">
            <div className="bg-[#070707] p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400 mb-5">Dash</p>
              <DemoList variant="dash" />
            </div>
            <div className="bg-[#070707] p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400 mb-5">Arrow</p>
              <DemoList variant="arrow" />
            </div>
            <div className="bg-[#070707] p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400 mb-5">Square</p>
              <DemoList variant="square" />
            </div>
          </div>
          <CodeBlock code={variablesCode} title="customize with variables" />
        </section>

        {/* ── The snippet ── */}
        <section>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-6">
            03 — The snippet
          </p>
          <p
            data-no-typeset
            className="text-base text-neutral-400 mb-6 max-w-2xl leading-relaxed"
            style={{ fontFamily: "var(--font-source-sans)", textWrap: "pretty" }}
          >
            Copy it standalone, or skip it entirely — the engine injects this
            automatically for every list on a page running typeset.
          </p>
          <CodeBlock code={cssCode} title="silver-bullet.css" />
        </section>
      </div>
    </main>
  );
}
