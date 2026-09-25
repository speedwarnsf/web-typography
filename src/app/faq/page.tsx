import type { Metadata } from 'next';
import Link from 'next/link';
import { PINNED_VERSION } from '@/lib/install-snippet';
import '../install/install.css';

// The standard objections to JavaScript typography, answered with what the
// test suite measures. Keep in step with the FAQ in packages/typeset-v4/README.md.

export const metadata: Metadata = {
  title: 'Typeset FAQ: screen readers, layout shift, SEO, copying, no-JS',
  description: 'What screen readers hear, whether it shifts layout, what search engines see, copying and find-in-page, printing, translation, no-JavaScript readers, and when Typeset runs.',
};

const QA: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Why not just use text-wrap: pretty?',
    a: <>Use it: it is the right baseline, and Typeset keeps it for readers without JavaScript. In Chrome and Safari it avoids one-word last lines. It does not know that &ldquo;a&rdquo;, &ldquo;the&rdquo; or &ldquo;of&rdquo; belong with the next word, and Firefox does not have it. Typeset adds grammar-aware breaks, the same result in all three engines, preserved links and styling, and a result your CI can check.</>,
  },
  {
    q: 'What do screen readers hear?',
    a: <>The same words as the source, with a line boundary at each generated break, as at any line end. The test suite reads the accessibility tree Chromium and WebKit actually build on every run, and Firefox&rsquo;s nightly, and requires every composed paragraph&rsquo;s words, and every link and heading name, to match the source text. Text in live regions is never composed, so status messages are not announced again. Spoken VoiceOver and NVDA output has not yet been checked by a person; see <a href={`/releases/${PINNED_VERSION}/SUPPORT.md`}>SUPPORT.md</a>.</>,
  },
  {
    q: 'Does it cause layout shift?',
    a: <>Almost never. Typeset keeps the browser&rsquo;s line count, except that body text may use one more line to fix a one-word last line or a stranded sentence opener. In the 4.2 audit, 0 of 400 paragraphs changed line count and the measured cumulative layout shift was 0. <code>mount()</code> waits for web fonts before it composes.</>,
  },
  {
    q: 'Is it bad for SEO?',
    a: <>No. The HTML your server sends is unchanged. Typeset adds line breaks in the browser only, and the text of every element stays the same.</>,
  },
  {
    q: 'What happens when someone copies text?',
    a: <>They get the original text, without the generated line breaks, as plain text and as HTML with absolute links. Find-in-page, Text Fragment links and <code>innerText</code> do see a line break at each generated break; that is a known limitation, listed in <a href={`/releases/${PINNED_VERSION}/SUPPORT.md`}>SUPPORT.md</a>.</>,
  },
  {
    q: 'Printing and translation tools?',
    a: <>Printed text wraps natively at the paper&rsquo;s width; add <code>--ts-break-display: inline</code> to your print CSS to print the composition instead. When Google Translate, Chrome or Edge translates the page, Typeset removes its line breaks without touching the text the translator is filling in, and composes again when the page returns to its original language. Details in <a href={`/releases/${PINNED_VERSION}/SUPPORT.md`}>SUPPORT.md</a>.</>,
  },
  {
    q: 'What about readers without JavaScript?',
    a: <>They get your CSS. Set <code>text-wrap: pretty</code> on paragraphs and <code>text-wrap: balance</code> on headings, and they get the browser&rsquo;s best.</>,
  },
  {
    q: 'When does it run, and can I defer it?',
    a: <>The pinned script tag runs after the page is parsed (<code>defer</code>), waits for web fonts, and composes what is on screen first, yielding between batches. To start later, install the npm package and call <code>mount()</code> when you choose, for example from <code>requestIdleCallback</code>.</>,
  },
  {
    q: 'What does it cost?',
    a: <>About 5 milliseconds per paragraph on a fast laptop and about 21 at a mid-range phone&rsquo;s speed, on the main thread. The first screen of a 200-paragraph article is done in about 55 milliseconds. Measured by <code>npm run bench</code>; the tables are in the repository&rsquo;s docs/BENCHMARKS.md.</>,
  },
  {
    q: 'Does it phone home?',
    a: <>No. No network requests, storage or telemetry, and no install scripts. The pinned file never changes, and its integrity hash makes the browser refuse it if it did.</>,
  },
];

export default function Faq() {
  return (
    <main className="in-root">
      <p className="in-label">FAQ</p>
      <h1>The usual questions about JavaScript typography.</h1>
      <p className="in-lede">
        Short answers, with the measurement behind each where there is one.
        The full contract, including what is not yet tested, is in{' '}
        <a href={`/releases/${PINNED_VERSION}/SUPPORT.md`}>SUPPORT.md</a>.
      </p>
      {QA.map(({ q, a }) => (
        <section key={q} style={{ marginBottom: 36 }}>
          <h2>{q}</h2>
          <p className="in-lede">{a}</p>
        </section>
      ))}
      <p className="in-fine">
        Something here wrong for your site? <a href="https://github.com/speedwarnsf/web-typography/issues/new/choose">Report it</a>, or <Link href="/install/frameworks">see the framework recipes</Link>.
      </p>
    </main>
  );
}
