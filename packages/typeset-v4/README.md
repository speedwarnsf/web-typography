# typeset.us

Better line breaks for web text: no stranded short words or one-word last
lines, links and styling intact, verified in Chrome, Safari and Firefox.

![The same paragraph at 375 px. Top: the browser with text-wrap: pretty leaves "a" at the end of three lines. Bottom: Typeset leaves none, in the same seven lines.](https://typeset.us/releases/4.3.0/before-after.png)

Typeset measures each paragraph in the browser, chooses where its lines
break, and checks the result after rendering. If a result is not better, or
does not verify, the paragraph keeps the browser's own layout and says why.
Live demo: https://typeset.us/proof

## Do I need it?

Start with CSS. Add Typeset where CSS stops.

| You want | Use |
| --- | --- |
| Balanced headlines | CSS `text-wrap: balance` |
| No one-word last lines, in Chrome and Safari | CSS `text-wrap: pretty` |
| No "a", "the" or "of" left at the end of a line; names and numbers kept with their words | Typeset |
| The same result in Firefox, which has no `text-wrap: pretty` | Typeset |
| Links, emphasis and React-rendered text kept exactly as authored | Typeset |
| A result your CI can check (`auditJSON()`, `npx typeset-audit`) | Typeset |
| Justified text with hyphenation | Not Typeset: CSS `text-align: justify` with `hyphens: auto`, or a TeX-style justifier |

On the typeset.us homepage demo, across 96 widths from 250 to 345 px, short
words left hanging at line ends went from 215 to 38 against Chromium's
`text-wrap: pretty`, and from 216 to 28 against Safari's. Firefox left a
one-word last line at 30 of the 96 widths; Typeset left none, in all three.
(Measured with the 4.3.0 candidate, which gives the same counts as 4.2.0;
scripts/field/sweep-homepage.mjs reproduces it.)

## Install

**A script tag**, pinned: the file never changes, and the browser refuses it
if it ever did.

```html
<script src="https://typeset.us/go@4.3.0.js" integrity="sha384-FILLED-BY-RELEASE-CUT" crossorigin="anonymous" defer></script>
```

It sets paragraphs, list items, headings, captions and table cells, with
English smart quotes and hanging punctuation. The same file is on npm as
`typeset.us/auto`, so jsDelivr serves it with the same hash:
`https://cdn.jsdelivr.net/npm/typeset.us@4.3.0/dist/auto.js`.
Exclude an element and everything in it with `data-no-typeset`.

**npm, for pages you script yourself:**

```sh
npm i -E typeset.us@4.3.0
```

```ts
import { mount, auditJSON } from 'typeset.us';

const controller = mount(document, 'article p, article h2');
await controller.ready;
console.log(auditJSON('article p, article h2'));
// On teardown: controller.disconnect();
```

`mount()` waits for web fonts, composes what is on screen first, and
recomposes when text, fonts or widths change. Call it once.

**React 18.2 or later, or any React 19**, for text React owns:

```tsx
import { TypesetText, TypesetRichText } from 'typeset.us/react';

<TypesetText as="h2" text={title} />
<TypesetRichText lang="en" smartQuotes="en">
  Read <strong>the notes</strong> at <a href="/gallery">the gallery</a>.
</TypesetRichText>
```

`as` is the host element: `p` (default), `h1` to `h6`, `span`, `div`, `li`,
`blockquote`, `figcaption`, `dd`, `dt`, `td`, `th`, `caption`, `label`,
`legend` or `summary`. A `ref` resolves to that element. `onResult(result)`
receives each composition's `Result`, as `typeset()` returns it.
`priority="sync"` composes in the React commit; by default a block React
renders in the browser composes before its first paint and offscreen blocks
follow in idle time. Server-rendered HTML (Next.js, Remix) first paints with
the browser's own wrapping and is composed after hydration, rewrapping
without adding a line (see the FAQ on layout shift).
`TypesetRichText` children must be text and host elements (`a`, `strong`,
`em`, `span` and the like): a component child, such as next/link's `<Link>`
or a router link, keeps the whole paragraph native
(`native:react-component`, with a console warning in development builds).
Use `<a>` there, or compose the rendered HTML with `mount()`.
Under jsdom or happy-dom (Jest, Vitest) nothing can be measured, so both
adapters render the text unchanged, report `native:environment` and never
throw. Both take the options below as props.

Give each piece of text one owner: the adapter, `mount()` or a script tag.
`mount()` and the loaders keep text that Svelte, Vue, Solid, Lit or React
update in place correct (SUPPORT.md lists the limits), but text React
renders is best set with the adapters. For Vue, Svelte, Astro and plain
HTML, see https://typeset.us/install/frameworks.

`-E` saves the exact version. A minor release changes default rendering only
to fix a verified defect (see [Stability](#stability)).

## Options

Every entry point takes the same options. Script tags take them as
attributes (last table).

| Option | Default | What it does |
| --- | --- | --- |
| `mode` | `'body'`; `'title'` inside h1 to h6 | `'title'` and `'heading'` balance short display text and never add a line. `'body'` composes paragraphs. `'ui'` never composes. Also `data-typeset-mode`. |
| `density` | not set | Not set: body text keeps the browser's line count, or uses one more line to fix a one-word last line or a stranded sentence opener. `'compact'`: one more line only for a one-word last line. `'editorial'`: one more line for better phrasing. |
| `maxLines` | not set | Most lines a result may use; a longer one is declined (`native:line-budget`). |
| `keep` | not set | Phrases to keep on one line, such as `['New York']`, matched ignoring case and surrounding punctuation. A phrase that fits the measure is never split; one the browser splits can earn one extra line (not with `density: 'compact'`). Titles keep phrases within their fewest lines. |
| `lineBreaks` | `'unicode'` | Unicode 17 line-break rules with English, French, German and Spanish preferences from `lang`. `'legacy'` is the earlier English-only path, kept for comparison. |
| `smartQuotes` | `false` | `'en'` turns straight quotes and apostrophes curly in English text. Changes the copied text. |
| `opticalHanging` | `false` | `true` hangs opening quotes and capitals into the margin when they fit. |
| `spacing` | `true` | Adjusts word spaces (-20% to +33%) on composed left-aligned body text to even the right edge. `false` also turns off `tracking`. |
| `tracking` | `true` | Adjusts letter spacing by at most 0.01em per line after word spacing. |
| `contour` | `'finished'` | Ranks candidates by their shape after spacing. `'natural'` is the earlier ranking. |
| `text` | | For framework adapters: the current author text. |

In development builds an invalid option value, an unknown option or a
non-string selector logs one `console.warn` (for example `[typeset]
smartQuotes must be "en" or false (received true)`) and otherwise behaves as
before. Production bundles leave the checks out; SUPPORT.md lists the
messages.

Two CSS hooks are supported. Every generated break is displayed through
`--ts-break-display` (default `inline`): print CSS sets it to `none`, so
printed text wraps natively at the paper's width; set it back to `inline`
to print a composition. While a block's width is changing and its composed
lines no longer fit, it carries `data-ts-stale` and shows native wrapping
until it is recomposed (text far offscreen, once it comes near the screen).
`dist/styles.css` has the rules; the engine also
installs them itself.

| Script attribute | Default | What it does |
| --- | --- | --- |
| `data-typeset-selector` | all prose blocks (`auto`), `[data-typeset]` (`go`) | Which elements to set. |
| `data-typeset-smart-quotes` | `"en"` (`auto`), off (`go`) | `"false"` turns quotes off; `"en"` turns them on. |
| `data-typeset-optical-hanging` | `"true"` (`auto`), off (`go`) | `"false"` or `"true"`. |
| `data-typeset-spacing` | on | `"false"` turns off word spacing and tracking. |
| `data-typeset-tracking` | on | `"false"` turns off tracking only. |

`typeset.us/go` (`dist/go.js`) sets only elements marked `data-typeset`;
`typeset.us/auto` (`dist/auto.js`, the typeset.us loader) sets all prose.
Both log a console note if nothing matches.

## What happened to my paragraph?

Every element Typeset composes or declines gets an outcome in
`data-ts-outcome` and `result.outcome`. Excluded content (`data-no-typeset`,
`nav`, code, forms) and live regions are skipped without an attribute:
`typeset()` returns `skipped:excluded` or `native:live-region` for them,
and `auditJSON()` counts them as `excluded` and `native:live-region`.
`native:` means Typeset left the browser's layout in place, and says why;
it is not an error. The ones you will see most:

| Outcome | Meaning |
| --- | --- |
| `composed:rich` | Composed and verified; links and styling kept. |
| `native:fits` | Fits on one line; nothing to do. |
| `native:sentence-aligned`, `native:paragraph-rhythm` | The browser's lines were already good, so they were kept. |
| `native:no-candidate` | Nothing fits the width; `result.constraint` says why. |
| `native:verification` | The result did not check out after rendering, so it was undone. |
| `skipped:excluded` | Inside `data-no-typeset`, code, a form control or a nav. |

All 42 outcomes, and the finishing statuses in `data-ts-spacing`,
`data-ts-tracking`, `data-ts-hanging` and `data-ts-quotes`:
https://typeset.us/releases/4.3.0/OUTCOMES.md. In TypeScript they are the
`Outcome` and `FeatureStatus` types, and `OUTCOMES` lists them.

## Checking it in CI

`auditJSON(selector)` returns errors, items to review, and outcome counts.
It passes when the scope is not empty, there are no hard errors (overflow,
stale output, word spaces hidden from assistive technology) and no element
was left unprocessed. It is not a verdict on how the text looks.

```sh
npm i -D playwright && npx playwright install chromium
npx typeset-audit --url http://localhost:3000 --selector 'article p'
```

The CLI is read-only (`--apply` composes an isolated preview), uploads
nothing, and exits 0 on a pass, 1 on a failed audit and 2 on a usage or
runtime error. It waits for the page's own composition to finish (the
loader's `window.TypesetReady`, or an outcome on every element in scope)
for up to `--timeout` seconds (30) per width, and names any element still
unprocessed. It needs Node 18.3 or later; the library itself runs in the
browser and has no Node requirement.

## What it costs

Composition runs in the browser, on the main thread.

- About 5 ms per paragraph (median; 15 ms at the 95th percentile) on an
  Apple M2 Pro in Chromium, about 21 ms with the CPU slowed 4x to
  approximate a mid-range phone, and about 19 ms in WebKit.
- `mount()` composes what is on screen first: the first viewport of a
  200-paragraph article was done in about 55 ms (230 ms at 4x), with the
  rest finished in the background in batches that yield to the page.
- React: one registry per document serves every block. Pushing a screen of
  38 `TypesetText` blocks at 4x CPU takes about 150 ms from the click to
  its first paint (Event Timing; 4.2.0: 230 ms, plain React: 55 ms), most
  of it one task of about 120 ms before that paint: the commit itself stays
  near 20 ms because only about 6 ms of composition runs inside it, and
  the rest of the on-screen work runs in the next frame. Re-renders that
  change nothing write nothing.
- Download, gzip: 54.9 KB for `go@4.3.0.js` or `auto.js`; with esbuild,
  Rollup, webpack or Vite, which tree-shake, 48.7 KB for a bundle that
  imports only `mount` and 48.5 KB for `TypesetText`. A bundler that does
  not tree-shake, such as Metro (Expo, React Native Web), ships all of
  `typeset.us/react`: 60.5 KB for `TypesetText` (4.2.0: 43.2 KB). No
  runtime dependencies.

These are 4.3.0 figures from `npm run bench`, measured beside 4.2.0 on the
same machine. Full tables, the method and the comparison:
https://github.com/speedwarnsf/web-typography/blob/master/docs/BENCHMARKS.md.

## What it won't do

- **Hyphenation.** Typeset never inserts hyphens, and leaves text with
  `hyphens: auto` or soft hyphens to the browser.
- **Justified text.** Typeset sets ragged-right text. A paragraph set with
  `text-align: justify` (or a `text-align-last` that differs from
  `text-align`) keeps the browser's layout and reports `native:justify`.
  For justified text use CSS `text-align: justify` with `hyphens: auto`.
- **Right-to-left, vertical, and non-Latin scripts.** Arabic, Hebrew, CJK
  and other scripts keep the browser's layout (`native:script`,
  `native:direction`).
- **Languages other than English, French, German and Spanish.** Other
  declared languages keep the browser's layout.
- **Editable text and live regions.** Editable content keeps the browser's
  layout, and so does text inside an `aria-live` region or a `status`,
  `alert`, `log`, `marquee` or `timer` role, or text that contains one, such
  as a paragraph with an inline result count (`native:live-region`): a
  screen reader would announce its every change. Regions in open shadow
  roots count (a toast that wraps a `<slot>` in `role="status"`); one set
  through `ElementInternals` or in a closed shadow root cannot be seen, so
  mark that text `data-no-typeset`.

## Browsers

Composes where `Intl.Segmenter`, `ResizeObserver` and `MutationObserver`
exist. The supported browsers also have CSS `text-wrap`: Chrome and Edge
114, Safari 17.4 and Firefox 125, or later. In an older engine, or a DOM emulation such as jsdom, the text keeps
the browser's layout with the outcome `native:environment`, and nothing
throws, including at import. Tested with Playwright's Chromium 149, WebKit
26.5 and Firefox 151. Physical phones and spoken screen-reader output are not
yet part of the automated tests; SUPPORT.md lists exactly what is.

## Accessibility

Typeset checks the accessibility tree the browser actually builds, not a
DOM approximation. `scripts/v4/verify-native-ax.mjs` reads Chromium's tree
(every word of every composed paragraph, and every link and heading name) and
WebKit's link and heading names on every test run, and Firefox's tree
nightly, and requires them to match the source text: in 4.3.0 every word
of every composed paragraph, link and heading matches in all three engines
(4.2.0 left 581 words unmatched in Chromium's tree and 381 in Firefox's,
and 38 of 63 link names and 23 of 24 heading names wrong in Chromium and
WebKit). A generated break that replaces a space is exposed to assistive
technology, so a screen reader meets a line boundary there, as at any line
end, and reads the words apart; a break after a hyphen stays hidden, so
"public-health" is still one word. `auditJSON()` fails if a generated break
hides a word space. Text in or around a live region is never composed, so
status messages are not re-announced. Spoken VoiceOver and NVDA output has not
been checked by a person yet (SUPPORT.md).

## Recommended CSS

Give the page good wrapping before the script runs, and for readers without
JavaScript:

```css
p, li, blockquote, figcaption { text-wrap: pretty; }
h1, h2, h3, h4 { text-wrap: balance; }
```

Typeset takes over the paragraphs it composes and restores your CSS when it
lets go.

## FAQ

More answers: https://typeset.us/faq

**What do screen readers hear?** The same words as the source, with a line
boundary at each generated break (engine accessibility trees are checked in
Chromium, WebKit and Firefox). 4.2.0 hid its breaks and joined the words
around them; see Accessibility above.

**Does it cause layout shift?** Rarely, and by one line at most.
Composition keeps the browser's line count; body text may use one more line
only to fix a one-word last line or a stranded sentence opener, which moves
what follows by one line. On narrow screens that line is common: about 1 in
6 body paragraphs take it at 320 px, 1 in 11 at 375 px, almost none at 768 px
and wider (4.2.0 the same). One taken in the first screen after the first
paint is a small layout shift: about half of our test loads at 320 and
375 px recorded one, at most 0.05, under the 0.1 "good" threshold. `mount()`
also waits for web fonts before composing.

**Is it bad for SEO?** No. The HTML your server sends is unchanged; Typeset
only adds line-break elements in the browser, and search engines index the
same text.

**Copy and paste?** Copying composed text gives the original text, without
the generated line breaks, in plain text and HTML, and leaves out hidden
content just as the browser's own copy does. Find-in-page and `innerText`
see a line break at each generated break (SUPPORT.md, known limitations).

**Printing, and translation tools?** Printed text wraps natively at the
paper's width (generated breaks are hidden in print; set
`--ts-break-display: inline` to print a composition). When Google
Translate, Chrome or Edge translates the page, Typeset removes its breaks
without touching the text the translator fills, reports
`native:translated`, and composes again when the page is shown in the
original language. `TypesetRichText` only pauses. A translation can show a
stray space before punctuation where composition split a paragraph into
many Text nodes; no text is lost. See SUPPORT.md.

**Without JavaScript?** Readers get your CSS, including the
`text-wrap: pretty` above.

**When does it run, and can I defer it?** The script tag runs after the page
is parsed (`defer`) and waits for web fonts. To start later, load the npm
package and call `mount()` when you choose, for example after
`requestIdleCallback`.

## Stability

Semver covers API names, `auditJSON` `schemaVersion`, outcome codes, CLI
exit codes and default rendering. A minor release changes default rendering
only to fix a verified defect, and lists each change in the CHANGELOG under
"Rendering changes". Published files never change. `go.js` is for trying
Typeset out: it follows 4.x and will never move to 5.0. Details:
https://github.com/speedwarnsf/web-typography/blob/master/STABILITY.md

## Glossary

- **Compose**: choose where a paragraph's lines break.
- **Native**: the browser's own layout, which Typeset keeps when it cannot
  improve on it safely.
- **Outcome**: what Typeset did with an element, such as `composed:rich` or
  `native:fits`.
- **Verify**: re-measure the rendered result and undo it if it does not
  match the plan.
- **Rag**: the uneven right edge of left-aligned text.
- **Contour**: the shape of the rag that Typeset ranks candidates by.
- **Finishing**: the small word-spacing and letter-spacing adjustments made
  after the breaks are chosen.
- **Stranded word**: a short word such as "a" or "the" left at the end of a
  line, apart from the word it belongs to.
- **One-word last line**: a paragraph's final line holding a single word
  (often called an orphan or widow).
- **Hanging punctuation**: opening quotes and some capitals set slightly
  into the margin so the text edge looks straight.
- **Pin**: a versioned file, such as `go@4.3.0.js`, whose bytes never
  change, loaded with its integrity hash.

## More

- Support range and known limitations: https://typeset.us/releases/4.3.0/SUPPORT.md
- Moving from 4.2: https://typeset.us/releases/4.3.0/MIGRATION.md
- For AI coding agents: https://typeset.us/releases/4.3.0/for-agents.md and
  `capabilities.json`
- Changes: https://github.com/speedwarnsf/web-typography/blob/master/CHANGELOG.md
- Security policy and reporting: https://github.com/speedwarnsf/web-typography/blob/master/SECURITY.md
- Issues: https://github.com/speedwarnsf/web-typography/issues

MIT. The line-break data is Unicode, Inc. (Unicode-3.0); third-party
notices are in THIRD-PARTY-LICENSES.txt. No install scripts, no network
access, no telemetry.
