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
(Measured with 4.2.0; scripts/field/sweep-homepage.mjs reproduces it.)
<!-- TODO(docs-sync): re-run the sweep on the 4.3.0 candidate and update these numbers. -->

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

`as` can be `p`, `h1` to `h6` or `span`.
<!-- TODO(docs-sync): K5 widens `as` and adds refs and onResult; list them. -->
Never point `mount()` or a script tag at text a framework updates; use the
adapter for that text. For Vue, Svelte, Astro and plain HTML, see
https://typeset.us/install/frameworks.

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
| `keep` | not set | Phrases to keep on one line, such as `['New York']`. Titles strongly avoid breaking inside them. <!-- TODO(docs-sync): C14 extends keep to body text. --> |
| `lineBreaks` | `'unicode'` | Unicode 17 line-break rules with English, French, German and Spanish preferences from `lang`. `'legacy'` is the earlier English-only path, kept for comparison. |
| `smartQuotes` | `false` | `'en'` turns straight quotes and apostrophes curly in English text. Changes the copied text. |
| `opticalHanging` | `false` | `true` hangs opening quotes and capitals into the margin when they fit. |
| `spacing` | `true` | Adjusts word spaces (-20% to +33%) on composed left-aligned body text to even the right edge. `false` also turns off `tracking`. |
| `tracking` | `true` | Adjusts letter spacing by at most 0.01em per line after word spacing. |
| `contour` | `'finished'` | Ranks candidates by their shape after spacing. `'natural'` is the earlier ranking. |
| `text` | | For framework adapters: the current author text. |

<!-- TODO(docs-sync): C9 adds a break display option and K11 validates options; add their rows. -->

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

Every element gets an outcome in `data-ts-outcome` and `result.outcome`.
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

All 38 outcomes, and the finishing statuses in `data-ts-spacing`,
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
runtime error. It needs Node 18.3 or later; the library itself runs in the
browser and has no Node requirement.

## What it costs

Composition runs in the browser, on the main thread.

- About 5 to 8 ms per paragraph on an Apple M2 Pro in Chromium, and about
  25 ms with the CPU slowed 4x to approximate a mid-range phone.
- `mount()` composes what is on screen first: the first viewport of a
  200-paragraph article was done in about 50 ms (210 ms at 4x), with the rest
  finished in the background in batches that yield to the page.
- Download, gzip: 43.2 KB for `go@4.3.0.js` or `auto.js`, 37.9 KB for a
  bundle that imports only `mount`, 38.2 KB for `TypesetText`. No runtime
  dependencies.

The timings are 4.2.0 figures from `npm run bench`, and the sizes are this
release's files. Full tables and the method:
https://github.com/speedwarnsf/web-typography/blob/master/docs/BENCHMARKS.md.
<!-- TODO(docs-sync): replace with the 4.3.0 bench after P2-P6 land. -->

## What it won't do

- **Hyphenation.** Typeset never inserts hyphens, and leaves text with
  `hyphens: auto` or soft hyphens to the browser.
- **Justified text.** Typeset sets ragged-right text.
  <!-- TODO(docs-sync): C3 declines justified paragraphs with native:justify; confirm. -->
  For justified text use CSS `text-align: justify` with `hyphens: auto`.
- **Right-to-left, vertical, and non-Latin scripts.** Arabic, Hebrew, CJK
  and other scripts keep the browser's layout (`native:script`,
  `native:direction`).
- **Languages other than English, French, German and Spanish.** Other
  declared languages keep the browser's layout.
- **Editable text, or text a framework updates behind its back.** Use the
  React adapters, or leave it native.

## Browsers

Needs `Intl.Segmenter`, `ResizeObserver`, `MutationObserver`,
`document.fonts` and CSS `text-wrap`: in practice Chrome and Edge 114, Safari
17.4 and Firefox 125, or later. Tested with Playwright's Chromium 149,
WebKit 26.5 and Firefox 151. Physical phones and screen readers are not
yet part of the automated tests; SUPPORT.md lists exactly what is.
<!-- TODO(docs-sync): K4 makes older engines keep native layout without throwing; say so. -->

## Accessibility

Typeset checks the accessibility tree the browser actually builds, not a
DOM approximation. `scripts/v4/verify-native-ax.mjs` reads Chromium's tree
(every word of every composed paragraph, and every link and heading name) and
WebKit's link and heading names on every test run, and Firefox's tree
nightly, and requires them to match the source text. `auditJSON()` fails if a generated break hides a word space
from assistive technology.
<!-- TODO(docs-sync): after C2, state what screen readers hear at generated breaks (for example that each is a line boundary in browse mode) and link the VoiceOver/NVDA note. -->

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

**What do screen readers hear?** The same words as the source. See
Accessibility above.
<!-- TODO(docs-sync): true once C2 lands (4.2.0 joined words at generated breaks); confirm with verify-native-ax. -->

**Does it cause layout shift?** Almost never. Composition keeps the
browser's line count; body text may use one more line only to fix a
one-word last line or a stranded sentence opener, which moves what follows by
one line. In the 4.2 audit, 0 of 400 paragraphs changed line count and the
measured CLS was 0. `mount()` also waits for web fonts before composing.

**Is it bad for SEO?** No. The HTML your server sends is unchanged; Typeset
only adds line-break elements in the browser, and search engines index the
same text.

**Copy and paste?** Copying composed text gives the original text, without
the generated line breaks, in plain text and HTML. Find-in-page and
`innerText` see a line break at each generated break (SUPPORT.md, known
limitations).
<!-- TODO(docs-sync): update if a newline-free rendering ships. -->

**Printing, and translation tools?** See SUPPORT.md, known limitations.
<!-- TODO(docs-sync): C9 (print) and C10 (translated pages) change these; summarise here. -->

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
