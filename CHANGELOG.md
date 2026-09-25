# Changelog

`go@x.y.z.js` URLs are **permanent**. Once a version is published its bytes
never change and the file is never removed, so a pinned `<script>` with an
integrity hash keeps working forever. Upgrading means changing the version in
your tag; nothing upgrades under you.

Hashes for every published version live in
[`public/sri.json`](public/sri.json).

---

## 4.3.0 - Unreleased

### Audit

- `auditJSON()` and `audit()` report two new errors, with `schemaVersion` still 1:
  `hidden-break`, a generated line break hidden from assistive technology
  where it replaces a space (the words on either side are read as one), and
  `isolated-space`, a word space alone beside an inline-block engine marker,
  which Chromium drops from its accessibility tree. 4.2.0's composed output
  has both, so audits of composed pages that passed under 4.2.0 can now fail.
- `issue.target` now resolves: every selector started `html:nth-of-type(0)`
  and matched nothing. Targets start from a unique id, from `body`, or are
  `:root`.
- Line-end reviews follow the compositor's own policy, which removes false
  positives: a word before sentence punctuation ("…what it was for.") and a
  letter designator ("type A") are valid line ends; an abbreviation is not a
  sentence end, so "Dr. Jones" and "8 a.m. Monday" are not stranded openers;
  untagged text gets no English word lists, as the compositor gives it none
  (text composed through the legacy break path still does).
- New review items: `bound-split` (a number and its unit, an honorific and a
  name, a label and its number, or a word and its letter designator split
  across lines), `split-ellipsis`, `line-initial-punctuation` (a line opening
  with a dash or closing punctuation) and `regressed-vs-native` (a composed
  element with more line-end reviews than its native layout had; 11 of 671
  composed corpus cells at 4 widths in Chromium under 4.3). New error:
  `alignment-lost` (see Rendering changes). Field shapes and `schemaVersion`
  are unchanged.
- A third new error, `stale-layout`: a composed block whose rendered line count
  differs from its composed lines (breaks + 1), because a font, spacing or size
  changed after it was composed. 4.2.0 left such blocks double-wrapped and
  its audit passed them.

### React adapters

- `TypesetText` and `TypesetRichText` recompose only on real changes. An
  inline `keep={[...]}` array, fresh JSX children, inline style objects and
  callbacks are compared by value, so a parent re-render that changes nothing
  writes nothing: 100 such re-renders of 6 + 6 blocks went from 119,736 DOM
  node writes to 0. `TypesetRichText` checks a computed layout key (text,
  widths, fonts, and the computed type of the host and its descendants)
  before replanning, so ancestor transforms and no-op class toggles cost no
  composition, and it carries an unchanged plan's spacing, tracking and
  hanging forward after re-verifying them instead of rebuilding them through
  four commits.
- During continuous resizing `TypesetRichText` shows native wrapping wherever
  its composed lines no longer fit (host attribute `data-ts-stale`), and
  recomposes once the size has held for 100 ms instead of on every frame.
- The React entry imports `flushSync` from `react-dom` (external, like `react`).
- One adapter registry per document replaces a controller per block: one
  MutationObserver, ResizeObserver and IntersectionObserver and one set of
  font and window listeners for every `TypesetText` and `TypesetRichText`
  (a 38-block screen created 38 of each). A block on screen composes before
  its first paint: in the commit while a 6 ms budget (from a learned cost per
  character) allows, then in the next animation frame; offscreen blocks
  compose in idle time, nearest first. A prop change of an on-screen block
  recomposes in its commit. Unmounting no longer restores the discarded host.
  New prop `priority?: 'auto' | 'sync'`; `'sync'` composes every block in the
  commit, as 4.2 did. Measured on the V4 benchmark (Chromium, 38-block push):
  commit 164 to 17 ms, INP proxy 232 to 144 ms and total blocking time 138 to
  68 ms at 4x CPU; 1,000 blocks at 1x commit in 18 ms instead of 1,463 ms.
- `ref` on `TypesetText` and `TypesetRichText` resolves to the host element
  (both are `forwardRef` components; a ref was dropped before, and
  `TypesetRichText`'s gave its class instance). `as` also accepts `div`, `li`,
  `blockquote`, `figcaption`, `dd`, `dt`, `td`, `th`, `caption`, `label`,
  `legend` and `summary`, with `cite`, `colSpan`, `rowSpan`, `headers`,
  `scope`, `htmlFor` and `value` attributes. New `onResult(result)` reports
  each composition as a `Result`. New exported types `TypesetTag`,
  `TypesetAdapterProps` and `Priority`.
- Nothing throws in test runners or older engines. Under jsdom and happy-dom
  (Jest, Vitest), and where `Intl.Segmenter`, `ResizeObserver` or
  `MutationObserver` is missing, `typeset()` and `planRichText()` return and
  both adapters report the new outcome `native:environment`, `mount()`
  returns an inert controller, and `document.fonts` is optional. Importing
  no longer constructs an `Intl.Segmenter` or inflates the Unicode line-break
  trie (the vendored module now initializes on first use; all 19,338
  LineBreakTest cases give identical breaks), so a missing API can no longer
  blank an application at import, and a bundle that imports only
  `smartQuotes` drops from 11.7 KB to 0.9 KB gzip. The script-tag builds do
  nothing where there is no `window`.
- Packaging: a CommonJS React entry (`dist/react.cjs`) for `require()` and
  Jest; `.` and `./react` give `import` and `require` their own types
  (`.d.ts` and `.d.cts`), so CommonJS consumers are no longer told the
  package is ESM-only (attw FalseESM); `./react` has a `default` condition;
  `./global` and `./go` ship `global.d.ts` and `go.d.ts` declaring
  `window.Typeset` and `window.TypesetReady`. The build recipe adds these
  files only when the package's exports name them, so a dry run at v4.2.0
  still reproduces its tarball. The 4.3.0 tarball grows from 48 to 83 files
  (2.57 to 3.42 MB unpacked), mostly `react.cjs` and its source map.
- Single-line blocks skip Unicode break analysis, and a first composition no
  longer computes an unused signature; outcomes are unchanged.

### API (additive)

- `OUTCOMES` lists every outcome code; the `Outcome`, `FeatureStatus`,
  `QuoteStatus`, `HangingStatus`, `SpacingStatus` and `TrackingStatus` types
  name them. `Result.outcome` and `Result.features` use these types while
  still accepting any string, so existing code compiles unchanged.
  OUTCOMES.md (also in the package and at docs/outcomes.md) says what each of
  the 38 outcomes and 32 feature statuses means, whether it is expected, and
  what to do, grouped as composed, nothing to improve, unsupported content,
  couldn't improve safely and not processed.
- Every option documents its default in the type declarations. The
  `lineBreaks` comment said the default was the legacy path; the package
  default is `'unicode'`.

### Documentation

- The npm README is an introduction, not release notes: what Typeset does,
  a 375 px before/after image against `text-wrap: pretty`, a "Do I need it?"
  table (CSS `balance` and `pretty` first; Typeset for grammar-aware breaks,
  Firefox parity, preserved markup and checkable results; not for justified
  text), three pinned install paths, every option with its default, the
  common outcomes, what it costs, what it won't do, browser requirements,
  accessibility, baseline CSS for before the script runs, an FAQ, the
  stability promise and a glossary. Every link is absolute, so it works on
  npmjs.com. "New in" notes live here in the CHANGELOG.
- The repository README states the positioning against `text-wrap`, and its
  install lines are generated from the published version and sri.json at
  each cut (it had pinned 4.1.0).

- SUPPORT.md describes 4.3.0 and lists known limitations: generated line
  breaks and find-in-page, Text Fragments, `innerText` and selection; print;
  machine translation; CSP and Trusted Types; no hyphenation, justification
  or right-to-left text; the browser floor; framework-owned text. A new FAQ
  (typeset.us/faq, and in the README) answers what screen readers hear,
  layout shift, SEO, copying, printing and translation, readers without
  JavaScript, cost, and when it runs.
- Stale 3.x claims are gone from current docs and the site: "audit() returns
  []", "zero means zero", 1.4 to 1.6 ms per paragraph, 20 KB, English only,
  cloned links. The Show HN kit, the essay, SKILL.md's frontmatter, the agent
  contract (for-agents.md) and llms.txt describe 4.3; the 3.5 agent pages are
  marked historical. A client's name is gone from SUPPORT.md and the CHANGELOG.

### Installation and packaging

- The React peer is `^18.2.0 || ^19.0.0` (was `^19.2.3`), and Playwright is no
  longer a peer. `npm install typeset.us` no longer fails with ERESOLVE beside
  React 18, React 19.0/19.1 or an older pinned Playwright, and no longer
  upgrades `react` alone in apps locked to React 19.0 or 19.1 (which left
  `react-dom` behind and threw "Incompatible React versions"). The
  `typeset-audit` CLI still imports Playwright on demand and says how to
  install it. `TypesetText` uses a layout effect only in the browser, so React
  18 server rendering no longer warns. Both adapters declare `ReactElement`
  return types, so the published `.d.ts` compiles against @types/react 18.3
  and 19.0 with `skipLibCheck: false`. Tested by
  `scripts/v4/verify-react-matrix.mjs` over React 18.2.0, 18.3.1, 19.0.8,
  19.1.9, 19.2.8 and 19.3.0 in Chromium, WebKit and Firefox.
- npm metadata: a plain description, keywords (typography, line-breaking,
  text-wrap, orphans, widows, knuth-plass, hanging-punctuation, react and
  others), `repository.directory` so README links resolve on npmjs.com, and
  `bugs.url`. The `engines` field (`node >=22`) is removed: it made Yarn 1
  refuse installs of a browser library on older Node. The `typeset-audit`
  CLI needs Node 18.3 or later.
- The unpacked package is about 0.97 MB, down from 2.57 MB, 73% of which was
  source maps embedding every engine source. The ESM and CommonJS builds stay
  readable and unminified and ship without maps (your bundler minifies them;
  stack traces name real functions). `typeset.global.js` and `go.js` keep
  maps without embedded sources. Each bundle now ends with the license
  notices of the code it embeds (@cto.af/linebreak, unicode-trie-runtime,
  fflate and the Unicode line-break data), which minification had stripped,
  and `license` is `MIT AND Unicode-3.0`. The notices add about 150 bytes
  gzip to each bundle.

### Loaders and CDN

- The automatic website loader is on npm as `typeset.us/auto`
  (`dist/auto.js`), byte for byte the same file as
  `https://typeset.us/go@<version>.js`, so npm, jsDelivr and typeset.us serve
  one file with one integrity hash. `typeset.us/go` still composes only
  `[data-typeset]` targets. Each loader now logs one `console.info` when no
  element matches, instead of silently doing nothing.
- Bare `cdn.jsdelivr.net/npm/typeset.us` and `unpkg.com/typeset.us` URLs serve
  `dist/typeset.global.js` (the `jsdelivr` and `unpkg` fields), not the
  CommonJS build that browsers refuse to run.
- From the 4.3.0 cut, typeset.us publishes versioned `typeset@<v>.min.js` and
  `typeset@<v>.esm.js`, and `sri.json` lists only immutable paths. The
  go@4.2.0.js entry is unchanged. `go@4.js` follows 4.x, and `go.js` and the
  other unversioned aliases follow 4.x only: a 5.0 release will never move
  them. Versioned files are cached for a year, aliases and indexes for five
  minutes, all with `Access-Control-Allow-Origin: *`.
  docs/ops/vercel-firewall.md has the firewall bypass that stops bot
  challenges on these paths; it is applied in the Vercel project, not here.

### Website copy (typeset.us)

- The homepage names its baseline by engine ("Your browser, with CSS
  text-wrap: pretty" in Chrome and Safari; "Firefox has no text-wrap:
  pretty"), leads with the short words the browser leaves at line ends, and
  claims a one-word last line only in an engine that produces one. It had
  said "your browser abandons a word" in every engine, although Chrome and
  Safari never did at any of the 96 widths.
- A "For developers" band: the pinned script tag, npm and React, a "Do I
  need it?" table against CSS `text-wrap`, the measured gzip size from
  release.json (it said 38 KB; 4.2.0's loader is 42.4 KB), and links to
  GitHub, npm, the docs and new framework recipes at /install/frameworks
  (Next.js, Vite, Astro, SvelteKit, Vue). /utility describes the supported
  scope instead of "universal ... fixes all of this".
- /, /support and /library have their own titles, descriptions and unfurl
  images.

### Contributing

- CONTRIBUTING.md (setup, building the candidate, running and narrowing the
  suites, attaching `auditJSON` to a report), CODE_OF_CONDUCT.md (the
  Contributor Covenant 2.1), ROADMAP.md (what 4.4 and 5.0 hold, and why each
  waits), a "Bad line break" issue form that asks for the URL, width, font,
  browser, version, `auditJSON` output and a screenshot, an integration
  question form, and a pull request template with the rendering-change
  checklist.

### Stability

- STABILITY.md states what a version number promises: API names,
  `auditJSON` `schemaVersion` 1, outcome codes, CLI exit codes and published
  bytes do not break in 4.x, and a minor release changes default rendering
  only to fix a verified defect, listed under "Rendering changes" with its
  golden-diff count. Install with `npm i -E`, or pin `go@<version>.js` with
  its integrity hash. `go.js` and `go@4.js` follow 4.x and will never move to
  5.0.
- Every install line on typeset.us is generated at build time from
  `public/sri.json`: the pinned loader with its integrity hash and
  `crossorigin`, on the homepage, /install and each platform guide, /utility,
  /essay, the pairing-card and reading-lab templates and the grader. The
  evergreen `go.js` appears only with that label. Docs written before a cut
  carry a placeholder hash that `release-cut` fills.

### Release trust

- Releases are published by `.github/workflows/release.yml` from a `v*` tag,
  only after CI passed on that commit, `scripts/v4/release-check.mjs` rebuilt
  the ledger-recorded tarball from the tag byte for byte, and every suite
  passed against the committed dist. It publishes exactly
  `public/releases/<v>/typeset.us-<v>.tgz` with npm trusted publishing and
  provenance, checks the registry's integrity and attestation, and creates a
  GitHub Release from the CHANGELOG section with the evidence attached, so
  evidence no longer expires with CI artifacts. docs/RELEASING.md describes
  the whole flow.
- CI and nightly run with `contents: read` only, every action is pinned to a
  commit SHA, and Dependabot watches npm and GitHub Actions.
- SECURITY.md (also in the package): supported versions, private reporting,
  response targets. The DOM XSS in the 3.x `Typeset.auto()` heading branch,
  fixed silently in 3.4.1, now has an advisory draft, a deprecation command
  for 3.0.0 to 3.4.0 and an `advisories` list that each cut copies into
  release.json and sri.json. The vulnerable files stay online unchanged.
- The CHANGELOG has a 4.2.0 entry. docs/OWNER-ACTIONS.md lists the GitHub,
  npm and Vercel settings only the owner can apply.

### Website (typeset.us, not the package)

- `/api/fetch-url` no longer reaches private networks: it resolves the host
  and connects only to a checked address, refuses loopback, private,
  link-local (including 169.254.169.254), CGNAT, multicast and reserved
  addresses and their IPv6 forms, follows at most five redirects and checks
  each, allows ports 80, 443, 8080 and 8443 only, streams the body with a
  500 KB cap after decompression, and rate-limits each client to 12 requests
  a minute.
- `/audit` and `/dna` render fetched or pasted HTML inert: scripts, frames,
  plugins, `<base>`, refresh `<meta>`, event handlers and `javascript:` URLs
  are removed; `/audit` renders the sample in a shadow root so its styles
  cannot restyle the site, and `/dna` uses an iframe sandboxed without
  scripts. `/dna` no longer fails on pages with inline SVG.
- Every page has a nonce-based Content Security Policy (`script-src` with a
  per-request nonce and `strict-dynamic`, `object-src 'none'`,
  `base-uri 'self'`, `frame-ancestors 'self'`), plus `nosniff`,
  `X-Frame-Options: SAMEORIGIN` and a referrer policy. Pages are rendered
  per request so each gets a fresh nonce. Next.js is 16.3.6; `npm audit`
  reports no vulnerabilities.

### Rendering changes

Each default-output change in 4.3 is a defect fix, listed here with its
golden-diff count: the published 4.2.0 build against the candidate over the
same blocks in Chromium, WebKit and Firefox. The accessibility entries were
measured with element screenshots at DPR 2, `measureLayout` line boxes,
outcomes, feature statuses, copy text and markup; the composition entries
with the cells of `scripts/v4/verify-golden.mjs` (85 corpus paragraphs at
240, 320, 400 and 560 px in Georgia and the bundled Fraunces, per engine)
whose outcome, finish features or markup differ from 4.2.0.

- **Generated line breaks are word separators again (accessibility, C2).** A
  generated `<br>` that stands in for a collapsed space is no longer
  `aria-hidden`, so engine accessibility trees stop joining the words on either
  side of it ("galleryguide"), including inside link and heading names. A break
  after a hyphen or dash stays hidden, so "public-health" is still one word.
  Spacing and hanging markers are `display: inline` instead of `inline-block`,
  which stops Chromium dropping the word space beside them. The same applies
  to `TypesetRichText`. Assistive technology now meets a line boundary at each
  generated break, and WebKit accessible names contain a newline there.
  Golden diff over 316 blocks (309 composed) in each engine: markup changed in
  311 blocks (310 in WebKit), only in those two attributes; 1,087 of 1,103
  generated breaks are now exposed and 16 hyphen breaks stay hidden; 0
  screenshots, 0 line boxes, 0 outcomes, 0 feature statuses and 0 copied texts
  changed.
- **Live regions are no longer composed (accessibility, C4).** Text whose
  nearest region has `aria-live="polite"` or `"assertive"`, or (without
  `aria-live="off"`) `role="status"`, `alert`, `log`, `marquee` or `timer`, or
  is an `<output>`, keeps native wrapping.
  4.2 composed it and rewrote it on every resize, font load and idle pass
  (51 mutation records on mount and 180 more across two resizes for one status
  paragraph), and Chrome announced those rewrites, so screen readers repeated
  status messages. `typeset()` returns `native:live-region` and writes nothing,
  `mount()` and both loaders skip such targets (and release one whose region
  turns live), `TypesetRichText` reports `native:live-region`, and `auditJSON()`
  counts them under that outcome. Golden diff: paragraphs inside live regions
  change from composed to native (5 of 8 on the live-region fixture, per
  loader and engine); 0 of 316 blocks change in the golden A/B, which has no
  live regions.
- **Smart quote corrections (C15).** A single quote right after a curled
  opening double quote now opens too: `"'Quoted' inside,"` gives
  “‘Quoted’ inside,” (4.2 gave “’Quoted’). Rock ’n’ roll,
  ’bout, ’round and ’nuff are elisions (4.2 gave ‘n’ and ‘bout).
  Glyph substitutions only, length-preserving; ’90s, ’Tis, ’em, primes
  such as 5'10" and possessives are unchanged, and single quotes never become
  double. Golden diff: 0 of 173 corpus texts (14 with straight quotes) change;
  the changes are exactly the patterns above. `TypesetText` also curls quotes
  during render, so its server HTML has them (a Next production build: 8
  curled, 0 straight, no hydration messages in three engines; 4.2 had 2 of 10
  curled before hydration).
- The legacy `renderFrozenLines()` export no longer sets the non-ARIA
  `role="text"`, which emptied a composed heading's accessible name in WebKit,
  and clears the element with `replaceChildren()` instead of `innerHTML`, so it
  runs under Trusted Types.
- **Justified text is left as the author set it** (`native:justify`). A
  generated break ends its line, so every composed line took the last-line
  alignment: `text-align: justify` became ragged right, and a `text-align-last`
  that differs from `text-align` applied to every line, while `audit()` still
  passed. Multi-line paragraphs whose computed `text-align` is `justify` or
  `justify-all`, or whose `text-align-last` differs from `text-align`, are now
  declined under every entry point (`typeset()`, `mount()`, `go.js`,
  `TypesetText`, `TypesetRichText` and the legacy renderer). A single line
  still reports `native:fits`. Golden diff: 336 of 336 justified cells per
  engine (42 corpus paragraphs), 0 of the rest. `audit()` reports a new error,
  `alignment-lost`, for a composed element whose alignment later changes to
  one the breaks cannot keep.
- **Abbreviations, units, honorifics, labels and letter designators stay
  with their words** (English). Every word ending in a period counted as a
  sentence end, so the compositor paid to break after "Dr.", "Fig.", "a.m."
  and "U.S.", and the single-letter penalty pushed units and designators to
  the next line ("1,200 / m", "hepatitis / C", "World War / I"). Now an
  abbreviation (Mr, Mrs, Ms, Dr, Prof, St, Mt, Jr, Sr, vs, etc, e.g, i.e,
  a.m, p.m, p, pp, Fig, No, Vol, Ch, Inc, Ltd, Co, dotted initialisms and
  single initials) ends no sentence; splitting a number from its unit, an
  honorific from a name, a label from its number or a word from its letter
  designator costs what a weak line end costs; and only the article and the
  pronoun "I" pay the single-letter penalty. Golden diff: 0 of the 2,724
  corpus cells in each engine (the corpus has none of these constructions),
  and 43 (Chromium, Firefox) or 44 (WebKit) of 160 cells of the new
  adversarial set (`tests/v4-corpus-adversarial.json`), 41 of 160 through
  the legacy renderer. On that set, pairs split at line ends fall from 46
  (WebKit 44) under 4.2.0 to 12 (WebKit 11), against 26 in the browser's
  own layout; weak line ends stay at 46 (WebKit 46 to 48); lines added
  over native fall from 5 to 2. No orphan, overflow or source change.

Lifecycle entries were measured on the V4 corpus (85 paragraphs, every
fourth with a link and emphasis) at 320, 440 and 600 px:

- Generated `<br>` elements are written `display: var(--ts-break-display,
  inline) !important` instead of `display: inline !important`, and the
  `TypesetRichText` break carries `display: var(--ts-break-display, inline)`.
  On screen nothing moves: 251, 249 and 251 of 255 blocks change markup in
  Chromium, WebKit and Firefox, 0 differ once the break style is normalized,
  and 0 change outcome or rendered lines. In print, breaks are now `none` and
  text wraps natively at the paper's width, where 4.2.0 printed the screen
  breaks and alternated long and short lines.
- `typeset()` does not measure or compose text that is not rendered: in a
  `display:none` subtree it keeps an existing composition (4.2.0 restored
  native text and recorded `unmeasurable`), and text in a skipped
  `content-visibility:auto` section records `unmeasurable` instead of being
  composed from forced layout (4.2.0 composed it in Chromium and Firefox and
  cached `native:verification` in WebKit). `mount()` composes it when it comes
  into range. The corpus golden diff has no hidden text: 0 blocks change.
- `TypesetRichText` plans once from the native text and no longer re-plans
  after `document.fonts.ready` when nothing changed. 4.2.0 re-planned over
  its own composed markup, so its final breaks could depend on that history.
  Golden diff against 4.2.0 (60 corpus paragraphs, `TypesetText` and
  `TypesetRichText` with and without options, 320, 390 and 560 px, three
  engines; 2,160 settled blocks): 2 differ, both in WebKit at 320 px. In one,
  4.3 now gives the same breaks as `typeset()` for the same markup, where
  4.2.0's re-plan did not; the other is a block on which 4.2.0 differs from
  itself between runs. Chromium and Firefox: 0.

### Fixed

- **Strict Content Security Policy and Trusted Types (C5).** Measurement and
  line-wrap styles are restored property by property through the CSSOM, never
  by writing the style attribute. Under `style-src` without `'unsafe-inline'`,
  4.2 left `white-space: nowrap` on paragraphs and links in Chromium and WebKit,
  erased the author's CSSOM styles in Firefox (a 300px width became the
  container width), and logged a CSP error on every pass. `TypesetRichText`
  declined as `native:rich-whitespace` under that policy. Published bundles no
  longer read the bind-weight research global `__TYPESET_BIND__`; the research
  harness builds its own loader.
- **Hidden content stays off the clipboard (C11).** A copy that touches a
  composed paragraph is serialized by the engine; 4.2 built its HTML from
  `range.cloneContents()`, which keeps what native copy leaves out, so a
  select-all or a cross-paragraph copy pasted `display:none` notes, hidden
  inputs such as CSRF tokens, `visibility:hidden` text, templates, scripts and
  styles. The clone is now walked in step with its source and those nodes are
  dropped; if the two ever disagree, only plain text is written.
- **Framework text updates never leave stale text (C6).** Composition splits
  author Text nodes, and frameworks keep the node they created. When Svelte,
  Vue, Solid, Lit or React (outside the adapters) set its `.data`, 4.2 replaced
  only line 1 and left the old lines 2..n on screen, merged them back on
  `restore()`, and `disconnect()` kept them. Solid and Lit updates were lost
  outright once a marker or tracking wrapper took their node's position, and
  React threw (removeChild) when it removed a Text node tracking had moved,
  unmounting the app. Now the mount observer removes the stale fragments
  within the mutation's microtask, before any frame, and recomposes; every
  cleanup drops the fragments of a node that was written to or removed instead
  of merging them; and Text nodes Solid or Lit address by position, and React's,
  stay in place (left empty, their text wrapped beside them). Chromium drops a
  whitespace-only Text node beside an empty one or a comment from its
  accessibility tree, so the engine puts an empty `<wbr>` between such a space
  and an emptied node, and never splits a comment-adjacent node down to its
  opening space. No rendering change: 0 pixel, line box, outcome or feature
  differences on the framework fixtures (48 paragraphs per engine) or in the
  golden A/B against 4.2.0.
- `TypesetRichText` with `smartQuotes="en"` but no `lang` of its own warns
  once in development builds; it leaves quotes as written, as before (C15).
  The package build leaves `process.env.NODE_ENV` to the application's bundler.
- `keep` works in body text. It was typed and exposed on both React adapters,
  but body composition never received it; it only switched off native
  retention. A kept phrase that fits the measure is now never split, a phrase
  the browser splits can earn one extra line (not with `density: 'compact'`),
  and a phrase longer than the measure is split as few times as possible.
  Matching ignores case, NBSP and punctuation around the phrase, in titles
  too, where a fitting phrase is held within the minimum line count. Native
  retention is kept unless the native layout splits a kept phrase. Output with
  `keep` omitted is unchanged (golden diff 0).

### Lifecycle

- `mount()` works when a parent page mounts into a same-origin iframe
  document: inserted paragraphs, text edits, resizes and fonts inside the
  iframe are picked up (nodes from another realm failed `instanceof` checks).
- Ancestor class and style changes no longer recompose owned text. The
  controller rechecks a layout key built from computed values (fonts, metrics,
  width, effective scale and zoom) and composes only when it changed: 60
  frames of an ancestor transform animation, a body class with no styles or a
  scroll-linked custom property on `<html>` now cause 0 compositions (4.2.0:
  92 to 174 over 40 paragraphs). Removing nodes walks the removed subtree
  instead of every claimed element.
- Composed text follows text metrics, not only width: fonts that finish
  loading (including CSS-requested fonts in WebKit, which fires no loading
  events), the text-spacing overrides of WCAG 1.4.12, a browser font-size
  setting, rules changed through the CSSOM, and transitions or animations of
  font weight, size or spacing. A same-width height change makes the
  controller verify rendered lines against the composition. One set of font,
  stylesheet and transition listeners serves every controller and
  `TypesetRichText` in a document.
- Hidden text keeps its composition. A tab, dialog, accordion or stack card
  hidden with `display:none`, the `hidden` attribute or `content-visibility`
  and shown again at the same width paints its composed lines in the first
  frame, instead of native lines re-broken a moment later (field report b),
  with `mount()`, `TypesetText` and `TypesetRichText`. Text an attribute
  change reveals at a new width is composed before that frame paints. Text
  in a skipped `content-visibility:auto` section composes when it comes into
  range; WebKit had cached a failed measurement there.
- No double-wrapped frames during resizes or in print. A block whose width
  changes is recomposed once the size has held for 100 ms, not every frame;
  meanwhile, if it is narrower than its widest composed line, it shows native
  wrapping (`data-ts-stale`). The switch is written before the frame's layout
  (in the mutation callback for a script-driven width, in the window's resize
  event, or in the next animation frame for changes no observer sees). Print
  shows native wrapping and pauses composition. `--ts-break-display` and
  `data-ts-stale` are supported hooks; see SUPPORT.md.
- The scheduler no longer starves on a busy page. An idle callback that fires
  on its 200 ms timeout gets the full 8 ms budget instead of one block, and
  text near the viewport is composed in the next task rather than waiting for
  idle time: with 12 ms of script per frame, visible paragraphs compose in
  about 125 ms and 60 paragraphs in about 3 s (4.2.0: about 2 s and 13 s).
  After a resize, blocks on or within a viewport of the screen are
  recomposed; offscreen blocks wait until they come near.
- Machine translation no longer garbles or loses text. When the page is
  translated (the `translated-ltr`/`translated-rtl` class Google Translate and
  Chrome set on `<html>`, a `<font>` wrapper inside composed text, or Edge's
  `_msttexthash`), `mount()` and `typeset()` remove their markers and unwrap
  their wrappers by moving the existing Text nodes, never splitting, merging,
  editing or removing one, record `native:translated`, and compose nothing
  until the translation ends; then the current DOM is composed again.
  `TypesetRichText` freezes instead: it stops observing and replanning, but
  the breaks React rendered stay. 4.2.0 merged and edited the Text nodes the
  translator was filling, which lost sentences.

### API

- `mount('article p', options)` is `mount(document, 'article p', options)`;
  a string first argument used to throw.
- `typeset()` throws `TypeError: [typeset] typeset() expects an HTMLElement
  (received ...)` for a non-element, and `mount()` a `TypeError` naming what
  it received, instead of raw TypeErrors from inside the engine.
- Invalid options print one `console.warn` each in development (the ESM and
  CommonJS entries unless `process.env.NODE_ENV` is `production`; always in
  `typeset.global.js` and `go.js`), for example `[typeset] smartQuotes must
  be "en" or false (received true)`. Values keep their 4.2 behaviour, and
  production bundles contain none of these checks. SUPPORT.md lists the
  messages.

### Development

- `npm run build:dist` (also `build:candidate`) builds the engine into
  `output/candidate/` only. Releases are cut by `npm run release:cut`, the
  only step that writes `packages/typeset-v4/dist`, `public/releases/<v>/`,
  `public/go@<v>.js` or a version number.
- `public/releases/published.json` records every published artifact by hash;
  `verify:ledger` and CI fail if any changes.
- `npm test` builds the candidate and runs every suite against it, including
  the CLI, engine accessibility trees (`verify-native-ax.mjs`) and gzip size
  budgets. `npm run test:release` runs them against the committed dist.
- `npm run bench` is the V4 benchmark (`scripts/v4/bench-v4.mjs`): mount(),
  typesetAll(), React screens, ancestor class storms, hidden-to-shown and late
  fonts at 1x and 4x CPU, with long tasks, observers, listeners, DOM writes
  and bundle sizes. It regenerates docs/BENCHMARKS.md, which described 3.x.
  Runtime budgets run nightly and at release cut.
- New suites in `npm test`: `verify-break-semantics` (C2), `verify-strict-csp`
  (C5), `verify-copy-privacy` (C11), `verify-framework-text` (C6, with
  committed Svelte, Vue, Solid and Lit fixture bundles in `tests/frameworks/`),
  `verify-live-regions` (C4) and `verify-smart-quotes` (C15). Each fails on
  the published 4.2.0 build.
- Lifecycle suites in `test:v4`, each in Chromium, WebKit and Firefox:
  `verify-iframe-mount`, `verify-recompose-storms`, `verify-reflow-triggers`,
  `verify-visibility`, `verify-print-resize`, `verify-scheduler`,
  `verify-translation` and `verify-options`.

## 4.2.0 - 2026-09-17

The next public release after 4.1.0. No public API was renamed and no
required peer was added. (This entry was written after the release, from its
acceptance record, docs/RELEASE-4.2.0.md.)

- Two mounts from one engine copy no longer fight over the same element. The
  first mount owns it; a waiting mount takes over only when the first releases
  it. `controller.stats.overlappingTargets` counts the overlaps, and should be
  0 in a correct integration.
- Inline `white-space: nowrap` phrases keep their no-break boundary inside an
  otherwise wrapping linked or styled paragraph, instead of sending the whole
  paragraph back to native layout.
- Declared-English text prefers breaks outside capitalized name and
  designator pairs such as "Oak Street" or "Marquee Cinemas" when they fit.
  It is a bounded preference, not a parser, and never widens a line past its
  box.
- Title mode may end on a substantial final location word when that avoids
  splitting a recognized name.
- While a rich paragraph is composed, Typeset sets `text-wrap-style: auto`
  on it, so the browser's own `pretty` or `balance` cannot rewrap the chosen
  breaks. Teardown restores the author's wrapping and keeps unrelated style
  changes made in the meantime.

Rendering: paragraphs with inline nowrap phrases, name pairs or overlapping
mounts can break differently from 4.1.0. Pins, archives and 4.1.0 remain
unchanged: https://typeset.us/releases/4.1.0/.

## 4.1.0 - 2026-09-17

The next public release after 4.0.0. Private 4.0.1-dev labels are not public pins.

- Bounded per-line tracking after word spacing, preserving chosen breaks,
  final lines, source text, links and emphasis. Verified rollback and explicit
  tracking controls in DOM, React and script loaders.
- Incremental mount discovery, initially visible-text priority and yielded
  batches; real text, font and width changes still recompose.
- Optical hanging inside supported clipped containers when the full glyph fits.
  Partial application and unsupported font/clip contexts are reported honestly.
- Context-measured sliced inline-code boxes and pure 2D translation support.
- Sentence/clause-opener classification and default body line allowance repair
  the reported stranded "By" and "rule: fill" cases.
- Proof/essay comparisons measure active geometry and restore before source
  replacement; tracking, clipping, inline-code and controller regression suites.

Existing 4.0.0 and v3 pins/archives remain unchanged. Read the migration and
support contracts before upgrading. No changes specific to any client site are included.
The scheduler reduces redundant work, not all layout cost; external device,
spoken screen-reader and representative-device acceptance limits remain.

## 4.0.0 — 2026-09-17

The next public major release after 3.5.1. Internal candidate labels are not
part of the stable public sequence.

- Markup-preserving composition for ordinary links, emphasis and styled runs.
- Unicode break opportunities for declared English, French, German and Spanish.
- Finished-contour ranking over a bounded pool of up to 200 complete candidates.
- Full bounded word-spacing finish using measured natural spaces, with rollback.
- Full-width opening punctuation and font-specific ink-measured optical capitals.
- React text/rich-text adapters, source-preserving selection/copying, lifecycle restoration.
- ESM, CommonJS, browser global, typed React entry, CSS and local JSON audit CLI.
- Inspectable native fallback, coverage and feature outcomes instead of an empty-audit success claim.

The existing website loader keeps its automatic prose/headings scope, with
selector overrides and opt-outs. The npm /go entry remains explicitly scoped
to data-typeset. Module craft options are explicit. Read MIGRATION.md before
upgrading imperative/global integrations.

All previous pins are byte-for-byte unchanged. The complete previous stable
package, browser assets and source are archived under /releases/3.5.1/.
The original site's layout and four craft promises are retained.

Released with owner approval within SUPPORT.md's declared range; physical
mobile devices, spoken screen readers, other native clipboard applications
and representative-device performance remain independent acceptance work.

## 3.5.1 — 2026-07-28

Documentation only; no engine changes — `go@3.5.0.js` remains the current
pin and no bytes under `public/` or `dist/` changed. The npm tarball's
`AGENTS.md` now documents the 3.5.0 language gate (`skipped:non-english`)
and the wide-measure behavior, and every benchmark citation was re-measured
on the 3.5.0 engine (`npm run bench`): 1.6 ms median per paragraph and
92.9 ms full page at 1x (was 1.4 / 86.4 on 3.4.x), 7.1 ms / 418.5 ms at 4x.
docs/RESEARCH.md Part XII records the 3.5.0 derivations; TYPESET-NOTES.md
is marked historical.

---

## 3.5.0 — 2026-07-28

Three features this release exist because the site claimed them before the
engine had them. The claims were written for an engine that kept evolving
underneath them; the honest fix was to build the engine the copy described.
Everything below is corpus-measured (85 paragraphs × 5 widths, Chromium,
Source Serif 4) with the sweeps recorded in the profile comments.

### Added — the spacing envelope is measured, not assumed

Word-space tolerances derive from the font's own MEASURED natural space —
Tschichold's 80–133%, the envelope InDesign adopted — instead of fixed
constants assuming a quarter-em. The assumption was quietly wrong on real
faces: Source Serif's space is 0.204em, so the old caps stretched it to
140% and squeezed it to 75%, outside the doctrine on this site's own
reading face. For a true quarter-em face the derived envelope is identical
to the old constants; direct API callers who pass no measurement get the
historical behavior exactly. `finalValidate`'s bounds now derive from the
same envelope, so a line at a cap can never be composed and then silently
rejected.

### Added — a wide-measure profile (≥48ch)

The reading-measure profile treated 66ch exactly like 24ch, so wide columns
paid an extra line vs the browser on ~25% of the corpus and their longest
line froze visibly short of the measure. Wide measures now run tighter —
fill target 0.90, tight-line cliffs at .95/.97, candidate bar .985, the
short-line ladder shifted up 5 points. Measured: extra-lines-vs-browser
480px 28→21, 560px 21→12, 660px 12→6; zero new orphans, weak enders,
overflows, or fallbacks; narrow measures byte-identical.

At wide measures the profile also prices auxiliary line-enders at 3600
(from 1600) — the smallest swept value reaching ZERO aux enders ("…The
tell is") at every wide width, for the cost of one extra-line paragraph in
85. Narrow measures keep the gentle 1600: the documented economics trade.

### Added — the language gate

The engine reads English prose and nothing else — now enforced rather than
assumed. Non-English content is DECLINED (outcome `skipped:non-english`)
before any transform touches it: by a non-English `lang` attribute, by
majority non-Latin script, or by a 30+-word Latin-script paragraph carrying
not one word from a set effectively exclusive to English. Conservative by
construction — it declines only on positive evidence, so genuine English is
never refused. Documented limit: languages whose function words overlap
English heavily (Dutch, Scots) can pass the third check; the gate
under-declines rather than guess.

### Fixed — the grader and the compositor share one vocabulary

`audit()` counted last-line words with an alphanumeric filter, so a
standalone "&" was invisible and a deliberately correct
"…Sophisticated / & Editorial" graded as an orphan — the site failed its
own grader on /library, ten times. `audit()` now counts words through the
same token classifier the compositor uses; the CLI's in-page check
matches.

### Site

The grader detects installs (a typeset script tag in the fetched HTML) and
says so; `/fix?url=` prefills and runs, so the badge now links to a live
re-grade of the page it sits on. The specimen page credits real designers
instead of "Google Fonts". The copy truth pass: every claim on the site now
describes this engine, not a remembered or hoped-for one.

---

## 3.4.2 — 2026-07-28

### Changed — `playwright-core` is now an optional peer dependency

The engine in `dist/` never touches it; only the `npx typeset.us audit` CLI
does. Declaring it a hard dependency made every `npm install typeset.us`
pull an 8.9 MB headless-browser harness to get a 152 KB compositor — a
silent install-time bail point for exactly the people the package is for.
Installing for browser use now gets the engine alone.

**The one user-visible break:** the CLI now requires
`npm i -D playwright-core` (it drives your installed Chrome or Edge and
downloads no browsers). Run without it, the CLI prints that instruction and
exits 2 — "could not grade," per its documented contract.

**No engine changes.** `go@3.4.1.js` remains the current pin; no file under
`public/` or `dist/` changed bytes. Sites — pinned, evergreen, or
vendored — have nothing to update.

---

## 3.4.1 — 2026-07-28

### Fixed — author `<br>` was silently destroyed, and could weld words

The plain compositor path admitted `<br>` children (a leftover allowance for
a renderer that no longer emits them) and then read the paragraph through
`textContent`, where `<br>` contributes nothing. A deliberate break —
poetry, an address — was silently discarded, and `bay<br>and` composed as
`bayand` with `data-ts-outcome="composed"`. Paragraphs containing `<br>` now
defer to the Phase-1 path, which preserves every node.

### Fixed — the readiness contract, this time at the wrapper

3.4.0 promised `data-typeset-done` on every outcome, but go.js's own
eligibility gate (short, centered, and `pre`/`code`/`.demo` paragraphs)
rejected elements *before* the engine ran and marked nothing — so the
documented poll still hung on any real page. Wrapper skips now record
`skipped:short` / `skipped:excluded` / `skipped:centered` and set the flag;
a thrown compose records `fallback:error` and sets the flag. Elements opted
out with `data-no-typeset` (self or ancestor) remain untouched — that is the
author's exclusion, not the engine's decision.

### Fixed — spurious recomposes from unseeded width tracking

The resize observers (go.js and the site pipeline) discarded whole entry
batches while the engine's own writes were in flight, without recording
widths. The first later event for such an element — including a pure height
change, the exact case the width filter exists to ignore — read as a width
change and forced a flatten-and-recompose of a paragraph whose measure never
moved. Widths are now recorded on every delivery; first sight seeds
silently. The one deliberate exception: an element composed while
`unmeasurable` that arrives with real width recomposes immediately — the
0 → N retry is the reason the flag exists.

### Fixed — possessive closed bigrams never bound

`New York’s` split at any weight: the follower trim only strips trailing
punctuation, and a possessive ends in a letter. The partner lookup now also
strips `’s`/`'s`, so `New York’s subway` binds exactly like `New York,`.

### Fixed — accessibility and injection

Rich-composed paragraphs no longer get `role="text"`, which flattened their
links out of the accessibility tree in WebKit/VoiceOver. And
`Typeset.auto()`'s heading branch no longer round-trips element text through
`innerHTML` — escaped user text could re-enter the DOM as live markup.

### Changed — hung list markers are now actually automatic, for prose lists

The docs said any list on a page running typeset() gets `ts-styled`
automatically; the engine only applied it when handed the `<ul>` itself,
which go.js never does. `typeset()` on an `<li>` now styles its parent
`<ul>` — but only a PROSE list: items still rendering as `list-item`,
markers still browser-default (`list-style-type` not already `none`), and
not inside `nav`/menu landmarks. A list the author already restyled — navs,
menus, card grids, flex layouts — is design, not typography, and is never
touched. Pinned versions are unaffected, as always.

### Build — pins are now enforced, not just promised

`build:dist` refuses to rewrite a committed `go@x.y.z.js` whose bytes
differ — an engine change without a version bump fails the build instead of
silently rewriting a published pin out from under its integrity hashes.
Version substitution now also covers prose references
(`typeset.us@x.y.z`), which had advertised 3.0.0 in the agent docs for four
releases. Declaration files ship NodeNext-safe relative imports.

### Site

The homepage hero and manifesto — self-composed for the line-by-line
reveal — now recompose when their width changes, so a load in a hidden or
zero-width context (embedded panes, background tabs) no longer leaves the
flagship headline browser-wrapped forever. Reading paragraphs that carried a
blanket `data-no-typeset` are back in the pipeline, so "every paragraph on
this page is set live by the engine" is true again, including the paragraph
that says it.

---

## 3.4.0 — 2026-07-24

### Added — phrase binding

The compositor now penalises a line break that splits a two-word place name,
so `San / Francisco` stays whole where the rag allows it. It is a **cost, not
a weld**: where the pair genuinely cannot fit, the penalty is outbid and the
break still happens.

Two rules, chosen for precision over reach:

- **open** — `san`, `santa` + any Title-Case word;
- **closed** — exact bigrams for everything else (`new`+`York`,
  `mount`+`Sinai`, …), which cannot false-positive.

Default weight `1600`, derived by sweeping 85 real paragraphs × 7 measures in
Chromium and WebKit. At that weight the feature is measurably free: no change
to short lines, weak line ends, or fill variance. Full method, evidence, and
an unusually long list of what the evidence does *not* support:
[`docs/BINDING.md`](docs/BINDING.md).

No published typographic authority prescribes this rule. It is an original
design decision and is documented as one.

### Fixed — `data-typeset-done` was never set on non-success paths

`data-typeset-done` was set only when a paragraph composed successfully. Every
`fallback:*`, `skipped:*`, and `unmeasurable` outcome left the flag unset, so
a paragraph the engine had already finished with looked permanently pending.

Anything polling that flag — the documented readiness check, test harnesses,
integrations — waited forever on a decided paragraph.

**If you poll `data-typeset-done`, this is the fix you want.** The flag now
means *the engine is finished with this element*, whatever it decided. Read
`data-ts-outcome` to find out what that decision was.

This also fixes a second, quieter bug: the `ResizeObserver` only re-runs
elements that already carry the flag, so a paragraph that was hidden or
zero-width when the engine first ran was skipped forever and never composed
once it became visible.

### Fixed — a published version could be deleted by the next release

The build removed older `go@x.y.z.js` files so the repo would carry exactly
one. Shipping 3.4.0 therefore 404'd `go@3.3.2.js` and broke every pin to it.

Old versions are now kept permanently and hashed into `sri.json` alongside
the current one. `go@3.3.2.js` has been restored, byte-for-byte identical to
what was published (verified against its original integrity hash).

### Performance

The binding test runs once per token at tokenise time rather than per
candidate break, where it measured 18% of compositor time in Chromium and 33%
in Firefox — and was paid even with the feature switched off.

### Known issue — Firefox composition is not deterministic

Roughly 1 page load in 30, Firefox composes a page differently from every
other load. Chromium and WebKit are byte-identical across every run.

This is **not new in 3.4.0** — it reproduces with phrase binding switched off
and is present in earlier versions. A fix was attempted, A/B tested, found to
make no difference, and removed rather than shipped as decoration. The
refuted hypothesis is written down in
[`docs/BINDING.md` §6](docs/BINDING.md) so the next attempt does not repeat
it. Reproduce with `tools-firefox-determinism.mjs` (needs ≥30 reps).

Scope CI rag gates per engine.

---

## 3.3.3 — 2026-07-23

`audit` CLI grades the settled rendering rather than a mid-composition frame,
and shares the engine's own weak-word vocabulary. Never released as a
`go@` drop-in; `go@3.3.2.js` remained the published pin.

## 3.3.2

npm `funding` field points at typeset.us/support.

## 3.3.1, 3.3.0

Inline composition: paragraphs containing links, `<em>`, and `<code>` compose
instead of falling back to Phase 1.

## 3.2.1 and earlier

See the git history.
