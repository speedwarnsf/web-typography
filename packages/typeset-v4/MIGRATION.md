# Moving to 4.3.0

4.3.0 follows 4.2.0. It is a minor release: no public API was renamed or
removed, and nothing new is required. Default rendering changes only where
4.2.0 had a verified defect; each change is listed under "Rendering changes"
in the CHANGELOG with the number of test paragraphs it changed.

## From 4.2.0

1. Keep your current lockfile and deployment until your own checks pass.
   Disconnect the old controller, or unmount the React adapters, before
   replacing the engine. Never run two Typeset versions on the same text.
2. Install the exact version: `npm i -E typeset.us@4.3.0`, or change the
   script pin to `go@4.3.0.js` with its integrity hash from
   https://typeset.us/sri.json.
3. React 18.2 and later now install without `--legacy-peer-deps`, and
   Playwright is no longer a peer. If you added either workaround for 4.2,
   remove it.
4. If you self-host or use jsDelivr and want every paragraph composed, use
   `typeset.us/auto` (`dist/auto.js`), the same file as the typeset.us
   loader. `typeset.us/go` still composes only `[data-typeset]`, and now says
   so in the console when nothing matches.
5. Re-run `auditJSON()` or `npx typeset-audit`. 4.3 audits two accessibility
   conditions that 4.2.0's own output had (`hidden-break`, `isolated-space`);
   4.3.0's output no longer has them. It also reports `stale-layout` (a
   composition double-wrapped by a later font or size change) and
   `alignment-lost` as errors, adds line-end reviews (`bound-split`,
   `split-ellipsis`, `line-initial-punctuation`, `regressed-vs-native`), and
   stops flagging sentence-final words, abbreviations and letter designators.
   `issue.target` selectors now resolve. `schemaVersion` is still 1.
6. Check the "Rendering changes" list in the CHANGELOG against your pages.
   What a site owner may notice:
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
   - `go@4.3.0.js` and `typeset.us/auto` compose content inside `.demo`
     and `[data-no-smooth]`, which `go@4.2.0.js` skipped. Mark content
     that should stay as the browser sets it with `data-no-typeset`.
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
the types still accept any string. Four outcomes are new:
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

Under Jest or Vitest (jsdom, happy-dom), 4.3 renders text unchanged with
`native:environment` where 4.2 could throw at import; remove any mock you
added for `Intl.Segmenter` or `ResizeObserver`.

Rollback: restore the recorded lockfile and deployment, or
`npm i -E typeset.us@4.2.0`, or pin `go@4.2.0.js` with its original
integrity hash. https://typeset.us/releases/4.2.0/ stays byte for byte as
published.

## Earlier versions

Each release's own guide stays in its archive, unchanged:

- 4.1.0 to 4.2.0: https://typeset.us/releases/4.2.0/MIGRATION.md
- 4.0.0 to 4.1.0: https://typeset.us/releases/4.1.0/MIGRATION.md
- 3.x to 4.0.0: https://typeset.us/releases/4.0.0/MIGRATION.md

Moving from 3.x: typeset.us 3.0.0 to 3.4.0 and the go@3.3.2.js and
go@3.4.0.js pins have a DOM XSS when a page calls `Typeset.auto()` on
`[data-typeset-heading]` text an attacker can influence. Those files stay
online unchanged, like every published file, and are deprecated on npm. Move
to 4.3, or at least to 3.4.1. Details:
https://github.com/speedwarnsf/web-typography/blob/master/SECURITY.md
