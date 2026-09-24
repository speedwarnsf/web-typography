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

None yet. Each default-output change in 4.3 is listed here with its golden-diff
count.

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
