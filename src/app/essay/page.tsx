import type { Metadata } from 'next';
import Link from 'next/link';
import ThreeWay from './ThreeWay';
import './essay.css';

export const metadata: Metadata = {
  title: 'The Browser Types. It Doesn’t Read.',
  description:
    'Every book you trust was set by people who knew what a sentence is. Your browser doesn’t. A working argument — with the browser default, text-wrap: pretty, and a compositor measured live on this page.',
};

// The essay is set by the engine it argues for: every paragraph below runs
// through the same pipeline as any site that adds the script tag. The
// argument and the demo are the same object.

export default function EssayPage() {
  return (
    <main className="es-root">
      <article>
        <p className="es-kicker" data-no-typeset>
          Typeset.us — an argument, set by its subject
        </p>
        <h1>The Browser Types. It&nbsp;Doesn&rsquo;t&nbsp;Read.</h1>
        <p className="es-byline" data-no-typeset>
          Dustin York, art director — thirty years of putting words in front
          of people
        </p>

        <p>
          Pick up any book you trust. Open it anywhere and run your eye down
          the right-hand edge of the text. You will rarely find a line that
          ends on the word &ldquo;of&rdquo; or a &ldquo;the&rdquo; dangling
          at an edge, cut off from its noun. You will not find the last line
          of a paragraph holding one abandoned word. Books have been free of
          these things for five hundred years — not by luck, but because the
          people who set them considered such breaks defects, and fixed them,
          by hand, line by line.
        </p>

        <p>
          Now open the last article you read — on this same screen.
        </p>

        <p>
          The browser sets text with one rule: fill the line until the next
          word doesn&rsquo;t fit, then break. It is fast, it is simple, and
          it has no idea what it is breaking. It doesn&rsquo;t know that
          &ldquo;of&rdquo; belongs to the word that follows it. It doesn&rsquo;t
          know a sentence just started. It doesn&rsquo;t know your paragraph
          ends on its most important word and just stranded it alone. The
          browser types. It doesn&rsquo;t read.
        </p>

        <p>
          This wasn&rsquo;t always going to be the deal. When text moved from
          metal to screens, the composing room&rsquo;s judgment — the part
          that read the line before breaking it — was supposed to be rebuilt
          in software. Donald Knuth and Michael Plass actually did it, in
          1981, and did it provably: score every way a paragraph could
          break, charge each flaw a cost, take the composition with the
          lowest total. Not taste — arithmetic you could check. Their
          algorithm went on to set the world&rsquo;s scientific literature
          through TeX, and when Adobe built InDesign it built the Paragraph
          Composer on their idea. QuarkXPress, which still broke one line at
          a time, spent the next decade losing designers to it — me among
          them. Print took the science and never looked back.
        </p>

        <p>
          The browsers skipped it. Not out of contempt — out of arithmetic. A
          nineties browser was laying out text while it was still downloading,
          into columns that could change width at any moment, on machines
          with nothing to spare; a one-pass greedy break was the only bill
          it could pay. The emergency measure calcified into the definition
          of a line on the web. The machines have gotten ten thousand times
          faster since. The rule was never revisited. The web got
          CSS instead: word-spacing, text-align, and forty years of waiting.
        </p>

        <h2>The platform&rsquo;s answer, measured</h2>

        <p>
          The platform is finally moving. text-wrap: pretty
          shipped in Chrome and Safari, and it is genuinely better than
          nothing — Safari&rsquo;s version even scores the whole paragraph.
          Credit where due. But look at what it optimizes: line lengths,
          hyphenation points, the geometry of the rag. No shipping
          implementation knows what a preposition is. None will spend a line
          to keep a sentence&rsquo;s opening intact. And the spec offers no
          way to ask what it did — pretty is defined as
          &ldquo;the browser may try harder,&rdquo; which cannot be tested,
          asserted on, or trusted with anything you care about.
        </p>

        <p>
          Don&rsquo;t take my word for any of this. Here is the same
          paragraph, three ways, measured from the actual rendering in your
          browser, right now:
        </p>

        <ThreeWay />

        <h2>Taste you can assert on</h2>

        <p>
          Typeset is a compositor that runs where the browser&rsquo;s
          decision actually lands: on the rendered line. It leans on Knuth
          and Plass&rsquo;s science without apology — whole-paragraph
          scoring, costs for flaws, the composition with the least total
          damage — because they were right, and forty years of everyone
          else&rsquo;s print work has already confirmed it. What we added is
          what their world never needed: the paragraph is scored the way a
          reader experiences it — meaning first, shape second. A
          line may not end on a word that belongs to the next one. A
          paragraph may not abandon its last word. The right edge should move
          the way a book&rsquo;s does: gently, without cliffs. Within those
          rules it chooses among thousands of candidate compositions, at
          about a millisecond and a half per paragraph.
        </p>

        <p>
          And then it checks its own work. Every composition is re-measured
          against the live
          rendering. If a webfont arrives late, if a container lies about its
          width, if any of a dozen browser quirks would make the composed
          paragraph worse than the browser&rsquo;s own, the engine restores
          the original and records why. The result is a property no CSS
          declaration can offer: audit() returns the measured
          violations on the page — overflows, orphans, weak line-ends — as
          data. Zero means zero. Your CI can assert it. Your AI agent can
          verify it. You can watch it count.
        </p>

        <p>
          That is the actual disagreement with the platform. Not whether the
          browser should try harder — it should, and it&rsquo;s starting
          to — but whether typography is a vibe or a claim. A vibe you take
          on faith. A claim you can measure. Five hundred years of
          composition happened one measurable decision at a time, and the
          people who made those decisions would be baffled by a web that
          calls its text &ldquo;pretty&rdquo; and cannot say what it fixed.
        </p>

        <h2>One line</h2>

        <p>
          This page runs the engine it argues for: every paragraph of this
          essay — including this one — was composed while your browser
          loaded it. You don&rsquo;t have to take that on faith either;
          paste this page&rsquo;s address into the grader and let it count.
          The install is one line, it works on any site you own, and it
          un-sets itself rather than ship a mistake:
        </p>

        <div className="es-snippet" data-no-typeset>
          <code>{'<script src="https://typeset.us/go.js" defer></script>'}</code>
        </div>

        <p className="es-close" data-no-typeset>
          Your site, set like a book — and it can prove it.{' '}
          <Link href="/fix">Grade your page</Link>, or{' '}
          <Link href="/install">install it</Link> in the next three minutes.
        </p>
      </article>
    </main>
  );
}
