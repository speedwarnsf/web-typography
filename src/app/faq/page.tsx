import type { Metadata } from 'next';
import Link from 'next/link';
import { PINNED_VERSION } from '@/lib/install-snippet';
import '../install/install.css';

// The standard objections to JavaScript typography, answered with what the
// test suite measures. Keep in step with the FAQ in packages/typeset-v4/README.md.

export const metadata: Metadata = {
  title: 'Typeset FAQ: screen readers, layout shift, SEO, copying, no-JS',
  description: 'What screen readers hear, whether it shifts layout, what search engines see, copying and find-in-page, printing, translation and reader views, page language, hydration errors, user comments, no-JavaScript readers, and when Typeset runs.',
};

const QA: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Why not just use text-wrap: pretty?',
    a: <>Use it: it is the right baseline, and Typeset keeps it for readers without JavaScript. In Chrome and Safari it avoids one-word last lines. It does not know that &ldquo;a&rdquo;, &ldquo;the&rdquo; or &ldquo;of&rdquo; belong with the next word, and Firefox does not have it. Typeset adds grammar-aware breaks, the same result in all three engines, preserved links and styling, and a result your CI can check.</>,
  },
  {
    q: 'What do screen readers hear?',
    a: <>The same words as the source, with a line boundary at each generated break, as at any line end. The test suite reads the accessibility trees the browsers actually build, Chromium&rsquo;s and WebKit&rsquo;s on every run and Firefox&rsquo;s nightly, and requires every composed paragraph&rsquo;s words to match the source text in Chromium and Firefox, and every link and heading name in all three (WebKit exposes no paragraph text to the test). Text in or around a live region is never composed, so status messages are not announced again. Spoken VoiceOver and NVDA output has not yet been checked by a person; see <a href={`/releases/${PINNED_VERSION}/SUPPORT.md`}>SUPPORT.md</a>.</>,
  },
  {
    q: 'Does it cause layout shift?',
    a: <>Rarely, and by one line at most. Typeset keeps the browser&rsquo;s line count, except that body text may use one more line to fix a one-word last line or a stranded sentence opener. On narrow screens that line is common: about 1 in 6 body paragraphs take it at 320 pixels, 1 in 11 at 375, almost none on desktop. One taken in the first screen after the first paint is a small layout shift: about half of our test loads at phone widths recorded one, at most 0.05, under the 0.1 &ldquo;good&rdquo; threshold. <code>mount()</code> waits for web fonts before it composes.</>,
  },
  {
    q: 'Is it bad for SEO?',
    a: <>Not for indexing or ranking. The HTML your server sends is unchanged; Typeset adds line breaks in the browser only, and search engines index the same text. It does affect readers who arrive from a search: a Text Fragment link (<code>#:~:text=</code>), which Google uses to scroll to and highlight the passage a result quotes, misses a phrase that spans a generated break, and so does find-in-page. Measured in Chromium, WebKit and Firefox, 43 of 60 five-word phrases were found at 375 pixels and 52 of 60 at 768, against 60 of 60 uncomposed; single words are unaffected. For documentation and reference pages, where readers search and link to passages, mark the content <code>data-no-typeset</code>.</>,
  },
  {
    q: 'What happens when someone copies text?',
    a: <>They get the original text, without the generated line breaks, as plain text and as HTML with absolute links. Find-in-page, Text Fragment links and <code>innerText</code> do see a line break at each generated break; that is a known limitation, listed in <a href={`/releases/${PINNED_VERSION}/SUPPORT.md`}>SUPPORT.md</a>.</>,
  },
  {
    q: 'Printing and translation tools?',
    a: <>Printed text wraps natively at the paper&rsquo;s width; add <code>--ts-break-display: inline</code> to your print CSS to print the composition instead. When Google Translate, Chrome or Edge translates the page, Typeset removes its line breaks without touching the text the translator is filling in, and composes again when the page returns to its original language. The translator still receives each composed paragraph in pieces: in a live English to Spanish check, 3 of 9 test paragraphs got a stray space before punctuation, where the uncomposed page had none. No text is lost. Safari&rsquo;s and Firefox&rsquo;s translators are not detected and have not been tested. Reader views keep the composed lines: Firefox&rsquo;s Reader View showed 35 of 40 test paragraphs composed at phone width as alternating long and short lines in its wider column; Safari Reader and Chrome&rsquo;s Reading mode have not been measured. Details in <a href={`/releases/${PINNED_VERSION}/SUPPORT.md`}>SUPPORT.md</a>.</>,
  },
  {
    q: 'Do I need to set the page language?',
    a: <>Yes, if you can: put <code>lang=&quot;en&quot;</code> on your <code>&lt;html&gt;</code> tag for an English page. Typeset keeps &ldquo;a&rdquo;, &ldquo;the&rdquo; and &ldquo;of&rdquo; off line ends only in text declared English, and applies French, German and Spanish preferences the same way. Untagged text gets neutral preferences, which fix far fewer line ends: on 42 test paragraphs at 375 pixels, lines ending in a stranded short word went from 59 to 7 with <code>lang=&quot;en&quot;</code>, and only to 36 untagged. The script tag also curls quotes only in text declared English. Tags such as <code>en_US</code> or <code>english</code> are read as the language they name. Right-to-left and non-Latin scripts keep the browser&rsquo;s layout.</>,
  },
  {
    q: 'Will it cause hydration errors on Next.js, Gatsby, Framer or Wix?',
    a: <>Not from 4.4 on pages it can recognise. If the script tag sets text before React takes over a server-rendered page, React reports a hydration error (#418) and renders the page again. On a page with a server-rendering framework&rsquo;s marker (Next.js, Gatsby, Framer, Astro, Vue 2), the script now waits for the framework to hydrate before it sets anything, for at most 10 seconds. Wix pages carry no such marker: add <code>data-typeset-defer=&quot;hydration&quot;</code> to the script tag. Neither Framer nor Wix has been checked on a live site yet. For text React renders, the React components avoid the question entirely; see <Link href="/install/frameworks">the framework recipes</Link>.</>,
  },
  {
    q: 'Is it safe on comments and other text people post?',
    a: <>Keep it to text you publish. The script tag sets every matching element, so mark comment areas <code>data-no-typeset</code> or give the script a narrower selector, and set <code>overflow-wrap: break-word</code> on containers of user-generated text. From 4.4, a paragraph with more than 500 characters between two places a line may break, which prose never has but a hostile comment can, keeps the browser&rsquo;s layout before anything is measured; in 4.3 such a run could freeze a Safari tab for tens of seconds.</>,
  },
  {
    q: 'What about readers without JavaScript?',
    a: <>They get your CSS. Set <code>text-wrap: pretty</code> on paragraphs and <code>text-wrap: balance</code> on headings, and they get the browser&rsquo;s best.</>,
  },
  {
    q: 'When does it run, and can I defer it?',
    a: <>The pinned script tag runs after the page is parsed (<code>defer</code>), waits for web fonts and, on a server-rendered page, for the framework to hydrate, and composes what is on screen first, yielding between batches. To start later, install the npm package and call <code>mount()</code> when you choose, for example from <code>requestIdleCallback</code>. For screenshots and visual tests, wait for <code>whenSettled()</code>, which resolves once composition is done.</>,
  },
  {
    q: 'What does it cost?',
    a: <>About 5 milliseconds per paragraph on a fast laptop and about 21 at a mid-range phone&rsquo;s speed, on the main thread. The first screen of a 200-paragraph article is done in about 55 milliseconds. Measured by <code>npm run bench</code>; the tables are in the repository&rsquo;s docs/BENCHMARKS.md.</>,
  },
  {
    q: 'Does it phone home?',
    a: <>The script does not: no network requests, storage or telemetry, and no install scripts. The pinned file never changes, and its integrity hash makes the browser refuse it if it did. This website sets no cookies and runs no analytics; <Link href="/privacy">the privacy page</Link> lists what its host logs and which tools contact another site.</>,
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
