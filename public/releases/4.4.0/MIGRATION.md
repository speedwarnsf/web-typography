# Moving to 4.4.0

4.4.0 follows 4.3. It is a minor release: no public API was renamed or
removed, and nothing new is required. It guards against a freeze that
user-generated text could cause, reads more `lang` spellings, can compose
more languages and inline markup if you opt in (`coverage: 'extended'`),
curls quotes only where they can be quotation marks, waits for a server-rendered page to hydrate before composing it, and
adds `whenSettled()` for visual tests. It also carries 4.3.2's fix for
off-screen React blocks. Each change to default rendering is listed under
"Rendering changes" in the CHANGELOG with the number of test paragraphs it
changed.

From 4.3.0, 4.3.1 or 4.3.2, follow "From 4.3" below. From 4.2.0, read
"From 4.2.0" first for what 4.3 changed, then "From 4.3", and install 4.4.0
directly.

## From 4.3

1. Keep your current lockfile and deployment until your own checks pass.
   Disconnect the old controller, or unmount the React adapters, before
   replacing the engine. Never run two Typeset versions on the same text.
2. Install the exact version: `npm i -E typeset.us@4.4.0`, or change the
   script pin to `go@4.4.0.js` with its integrity hash from
   https://typeset.us/sri.json.
3. **Smart quotes from the script tag.** The automatic loader (`go@4.4.0.js`,
   `typeset.us/auto`) now defaults to `smartQuotes: 'en-declared'`: it curls
   quotes only in text whose element or an ancestor declares `en` or `en-*`.
   In 4.3 untagged text counted as English, so an untagged German or French
   page got English quotes. If your page has no `lang` and you want curly
   quotes, add `<html lang="en">` (which also turns on English line-end
   preferences), or set `data-typeset-smart-quotes="en"` on the script tag
   for 4.3's behaviour. `data-typeset-smart-quotes="false"` still turns
   quotes off. On npm, `smartQuotes: 'en'` keeps its meaning (declared
   English and untagged text), and `'en-declared'` is new. The opt-in loader
   (`typeset.us/opt-in`) still leaves quotes off unless its script tag
   asks. Under every value, a double quote with white space or the text's
   edge on both sides (French spaced quotes), or with no open quotation to
   close (`width="100"`), now stays straight.
4. **Coverage.** Nothing to do to keep 4.3.1's coverage: the default,
   `coverage: 'core'`, composes what 4.3.1 composed. The new value
   `'extended'` opts in to composing paragraphs 4.3.1 left native: text
   declared in any Latin-script language (pt, it, nl, pl, sv, tr, vi and so
   on, with neutral line-end preferences, as for untagged text), a paragraph
   with a descendant in another Latin-script language (`<span lang="es">`),
   `time`, `dfn`, `kbd` and `ins`, `sup` and `sub` (also
   `vertical-align: super` and `sub`), visually hidden text (the sr-only
   pattern) and `aria-hidden` elements with no width. Set
   `coverage: 'extended'`, `data-typeset-coverage="extended"` on the script
   tag, or `coverage="extended"` on the React adapters. A paragraph 4.3.1
   composed is not changed by either value. Under both values, `lang` spellings such as `en_US`, `en_US.UTF-8` and `english` are
   read as the language they name, and up to three Greek or Cyrillic letters
   in a row inside Latin text ("5 μg", "α-synuclein") no longer leave the
   paragraph native. Languages written in other scripts (Arabic, Hebrew,
   Chinese, Japanese, Korean, Thai, Hindi, Greek, Serbian in Cyrillic), and
   a paragraph with a phrase in one, still keep the browser's layout.
5. **The run budget.** A paragraph with more than 500 code points between two
   line-break opportunities keeps the browser's layout before anything is
   measured, with the new outcome `native:run-budget`. Prose has no such
   runs; user-generated text can, and in 4.3 one could freeze a Safari tab.
   `OUTCOMES` now lists 43 codes: if your TypeScript switches exhaustively
   over `Outcome` with a `never` check, add a case for `native:run-budget`.
   There is no opt-out. Also set `overflow-wrap: break-word` on containers
   of user-generated text, or leave that text out (`data-no-typeset`).
6. **Server-rendered pages.** On a page with a server-rendering framework's
   marker (`#__next`, `#__NEXT_DATA__`, `self.__next_f`, `#___gatsby`,
   `[data-framer-hydrate-v2]`, `astro-island`, `[data-server-rendered]`, or a
   React root on the document, the body or a child of the body), both
   loaders now wait for the framework to hydrate before their first
   composition, then for one idle callback, for at most 10 s. This removes
   React's hydration errors (#418, #425, #423) and the client re-render they
   caused. The text paints with the browser's wrapping until then.
   `data-typeset-defer="none"` keeps 4.3's timing (compose at
   DOMContentLoaded); `data-typeset-defer="hydration"` waits without a
   marker (Wix pages carry none of these; SUPPORT.md says what it waits for
   there). `window.TypesetReady` still resolves after the first composition,
   so tests that await it keep working. On a page with a marker, a delay you
   added to the script tag to avoid hydration errors is no longer needed.
7. **Visual tests.** `whenSettled()`, from `typeset.us`, `typeset.us/react`
   and `window.Typeset`, resolves `{ settled: true }` once every `mount()`
   controller and React adapter host has its outcome, no composition work
   is queued, no web font is loading and a loader waiting for hydration has
   composed, or `{ settled: false }` at the timeout (default 10 s). It
   replaces fixed waits before screenshots. The package README's "Visual
   tests" section has Playwright and Storybook examples.
8. **Entry points.** `typeset.us/opt-in` is the new name of the opt-in
   loader (`dist/go.js`, which composes only `[data-typeset]` or
   `data-typeset-selector`). `typeset.us/go` is the same file and types, kept
   as a deprecated alias until at least 5.0; change imports when convenient.
   The bare jsDelivr and unpkg URLs (`https://cdn.jsdelivr.net/npm/typeset.us`)
   now serve `dist/auto.js`, the automatic loader, where 4.3 served
   `dist/typeset.global.js`, which composes nothing by itself. If you
   loaded the bare URL only for `window.Typeset` and call it yourself, name
   the file: `https://cdn.jsdelivr.net/npm/typeset.us@4.4.0/dist/typeset.global.js`.
   Otherwise the page now composes all its prose on load.
9. **Audit.** Text clipped on purpose (overflow `hidden` or `clip` with
   `text-overflow: ellipsis` or `-webkit-line-clamp`) is the review item
   `clipped` instead of an `overflow` error, so an audit that failed only on
   intentional truncation now passes. Two more review items: `untagged`
   (composed text with no `lang`, so English line-end preferences are off)
   and `uncomposed` (nothing in scope composed, for a reason other than
   nothing to improve, including `native:environment` under jsdom). `pass`
   and `schemaVersion` (1) are unchanged. `typeset-audit` prints one
   `typeset-audit: warning:` line on stderr for `uncomposed`, with the same
   exit code; if your CI fails on any stderr output, allow that line.
10. **Console.** After their first pass the loaders log at most two
    `console.info` lines, never a warning or an error: that composed text
    has no `lang`, and that none of the matched blocks was composed, with
    the most common outcome.
11. **Markup.** Spacing and hanging markers now carry only `margin-left`
    inline, and tracking wrappers only `letter-spacing` and `word-spacing`;
    their shared declarations moved to the engine's constructable stylesheet
    and `dist/styles.css` (inline, as in 4.3, where constructable
    stylesheets are missing). Line boxes and marker geometry are unchanged.
    A test or a script that read those style attributes needs updating, and
    a page's unlayered `!important` rule no longer reaches a marker's shared
    declarations.
12. **Sizes.** gzip: `go@4.4.0.js` and `dist/auto.js` 59.9 KB (4.3.1:
    56.5 KB); tree-shaken bundles importing only `mount` 52.4 KB (50.4),
    `TypesetText` 52.6 KB (50.5), `TypesetRichText` 48.8 KB (46.8) and
    `typeset()` 46.0 KB (44.3). The unpacked npm package is about 2.1 MB
    (4.3.1: 1.9 MB). Raise any size budget you keep for it.

New and optional in 4.4: `headings: false` (`data-typeset-headings="false"`)
makes `mount()`, `typesetAll()` and the loaders leave `h1` to `h6`,
`[role=heading]` and anything inside them untouched, with no outcome
written, for organisations that need an accessibility sign-off before a
heading holds a generated break (iOS VoiceOver may read such a heading as
two items; not yet checked by ear). `copy: false` (`data-typeset-copy="false"`,
`copy={false}` on the adapters) leaves an element's copying to the browser,
whose copied text then has a line break at every composed line end. The
types `SettleOptions` and `Settled` come with `whenSettled()`.

Rollback: restore the recorded lockfile and deployment, or
`npm i -E typeset.us@4.3.1` (or a later 4.3 patch), or pin `go@4.3.1.js`
with its original integrity hash. https://typeset.us/releases/4.3.1/ stays
byte for byte as published. 4.3 gets security fixes for 60 days after 4.4.0
ships (STABILITY.md).

## 4.3 patch releases

4.3.1 and 4.3.2 are patch releases of 4.3.0: they fix defects and change no
API, option, outcome code or default. From 4.3.0, installing a 4.3 patch
changes nothing else; the CHANGELOG lists what each fixes. 4.4.0 includes
both.

## From 4.2.0

4.3.0 followed 4.2.0. It was a minor release: no public API was renamed or
removed, and nothing new was required. Default rendering changed only where
4.2.0 had a verified defect; each change is listed under "Rendering changes"
in the CHANGELOG with the number of test paragraphs it changed. Moving from
4.2.0 to 4.4.0, apply these steps and then those under "From 4.3".

1. Keep your current lockfile and deployment until your own checks pass.
   Disconnect the old controller, or unmount the React adapters, before
   replacing the engine. Never run two Typeset versions on the same text.
2. Install the exact version: `npm i -E typeset.us@4.4.0`, or change the
   script pin to `go@4.4.0.js` with its integrity hash from
   https://typeset.us/sri.json.
3. React 18.2 and later install without `--legacy-peer-deps`, and
   Playwright is no longer a peer. If you added either workaround for 4.2,
   remove it.
4. If you self-host or use jsDelivr and want every paragraph composed, use
   `typeset.us/auto` (`dist/auto.js`), the same file as the typeset.us
   loader. `typeset.us/opt-in` (4.3: `typeset.us/go`) still composes only
   `[data-typeset]`, and says so in the console when nothing matches.
5. Re-run `auditJSON()` or `npx typeset-audit`. 4.3 audits two accessibility
   conditions that 4.2.0's own output had (`hidden-break`, `isolated-space`);
   4.3's output no longer has them. It also reports `stale-layout` (a
   composition double-wrapped by a later font or size change) and
   `alignment-lost` as errors, adds line-end reviews (`bound-split`,
   `split-ellipsis`, `line-initial-punctuation`, `regressed-vs-native`), and
   stops flagging sentence-final words, abbreviations and letter designators.
   `issue.target` selectors resolve. `schemaVersion` is still 1.
6. Check the "Rendering changes" list in the CHANGELOG against your pages.
   What a site owner may notice from 4.3:
   - Justified paragraphs (`text-align: justify`, or a `text-align-last`
     that differs from `text-align`) keep the browser's layout, as
     `native:justify`. 4.2 set them ragged right.
   - Text inside or containing live regions (`aria-live`, `role="status"`
     and similar) keeps the browser's layout, as `native:live-region`.
   - Print wraps natively. To print a composition, set
     `--ts-break-display: inline` in print CSS.
   - A block that is being resized shows native wrapping (`data-ts-stale`)
     until its size holds for 100 ms, or, far offscreen, until it comes
     near the screen. Hidden text keeps its composition.
   - While a page is machine-translated, composition steps aside
     (`native:translated`).
   - English abbreviations, units, honorifics, labels and letter designators
     stay with their words ("Dr. Jones", "12 kg", "Fig. 3", "type A"), and
     a capital letter stays with the noun it modifies ("B students").
   - A line holding text right after an HTML comment (React's server
     rendering separator `<!-- -->`, WordPress's `<!--more-->`) is not
     letter-spaced; the paragraph's other lines are.
   - The automatic loader (`go@4.4.0.js`, `typeset.us/auto`) composes
     content inside `.demo` and `[data-no-smooth]`, which `go@4.2.0.js`
     skipped. Mark content that should stay as the browser sets it with
     `data-no-typeset`.
   - Quote corrections: nested quotes open correctly and 'n', 'bout, 'round
     and 'nuff are elisions; `TypesetText` curls quotes in its server HTML.
   - Generated breaks that replace a space are exposed to assistive
     technology, so screen readers read the words on either side apart.
   - Direct `typeset()` on text in a skipped `content-visibility: auto`
     section records `unmeasurable`; call it again once the text is
     rendered, or use `mount()`, which does so itself.

New and optional in 4.3: the `Outcome` and `FeatureStatus` types and the
`OUTCOMES` list (OUTCOMES.md explains every code), and typed
`result.outcome` and `result.features`. Existing code keeps compiling:
the types still accept any string. Four outcomes were new:
`native:justify`, `native:live-region`, `native:translated` and
`native:environment`, and one tracking status, `native:tracking-comment`.
Also new:

- React adapters: a `ref` resolves to the host element; `as` also takes
  `div`, `li`, `blockquote`, `figcaption`, `dd`, `dt`, `td`, `th`, `caption`,
  `label`, `legend` and `summary`; `onResult(result)` reports each
  composition; `priority="sync"` composes in the commit, as 4.2 did for
  every block. The React entry has a CommonJS build (`require()`, Jest), and
  `react-dom` is an optional peer beside `react`.
- `mount('article p', options)` works without a root.
- `typeset()` and `mount()` throw a clear `TypeError` for a wrong target,
  and development builds warn once about an invalid option value or an
  unknown option (SUPPORT.md lists the messages). Values keep their 4.2
  behaviour.
- The `--ts-break-display` custom property and the `data-ts-stale`
  attribute are supported CSS hooks.
- `typeset.us/auto` is the automatic loader on npm.

Under Jest or Vitest (jsdom, happy-dom), 4.3 and later render text unchanged
with `native:environment` where 4.2 could throw at import; remove any mock
you added for `Intl.Segmenter` or `ResizeObserver`.

Rollback to 4.2: restore the recorded lockfile and deployment, or
`npm i -E typeset.us@4.2.0`, or pin `go@4.2.0.js` with its original
integrity hash. https://typeset.us/releases/4.2.0/ stays byte for byte as
published. 4.2.x gets security fixes only, until 2026-11-26, and has the
screen-reader defect 4.3 fixed.

## Earlier versions

Each release's own guide stays in its archive, unchanged:

- 4.2.0 to 4.3.1: https://typeset.us/releases/4.3.1/MIGRATION.md
- 4.1.0 to 4.2.0: https://typeset.us/releases/4.2.0/MIGRATION.md
- 4.0.0 to 4.1.0: https://typeset.us/releases/4.1.0/MIGRATION.md
- 3.x to 4.0.0: https://typeset.us/releases/4.0.0/MIGRATION.md

Moving from 3.x: typeset.us 3.0.0 to 3.4.0 and the go@3.3.2.js and
go@3.4.0.js pins have a DOM XSS when a page calls `Typeset.auto()` on
`[data-typeset-heading]` text an attacker can influence. Those files stay
online unchanged, like every published file. Move to 4.4, or at least to
3.4.1. Details:
https://github.com/speedwarnsf/web-typography/blob/master/SECURITY.md
