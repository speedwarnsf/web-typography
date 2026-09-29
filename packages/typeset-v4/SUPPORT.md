# Typeset 4.4.0 support contract

4.4.0, a minor release of 4.3 that includes 4.3.2's fix, is released with
owner approval within the range below. Local tests
are not certification for every device, browser, font, or sentence.
What each outcome means: OUTCOMES.md. What a version promises: STABILITY.md
in the repository. What changed from 4.3: MIGRATION.md.

- Horizontal LTR Latin prose/titles. Line-end preferences for declared
  English, French, German and Spanish; untagged Latin uses neutral
  preferences, and no language is inferred. Under the default,
  `coverage: 'core'`, other declared languages keep the browser's layout
  (`native:language`), as in 4.3.1. With `coverage: 'extended'` (opt-in),
  text declared in any other language whose likely script is Latin (pt,
  pt-BR, it, nl, pl, sv, tr, vi, fil, sw, ht, sr-Latn and so on) also
  composes, with neutral preferences, and an unreadable tag
  (`{{ page.lang }}`) counts as untagged. Under both, a `lang` spelled with an underscore or as a language
  name (`en_US`, `en_US.UTF-8`, `EN_us`, `english`, `Deutsch`, `francais`,
  `español`, and the unambiguous names for pt, it and nl) is read as the
  language it names; languages written in other scripts (ar, he, ja, zh, ko,
  th, hi, el, Cyrillic sr), and Latin text under such a tag, keep the
  browser's layout.
- Ordinary inline links, bold, italics and supported semantic spans. Author
  elements are not cloned/reparented by the imperative rich renderer. With
  `coverage: 'extended'` (opt-in) also `time`, `dfn`, `kbd` and `ins`; `sup` and
  `sub`, `vertical-align: super` and `sub`, and a `sup` raised with
  `position: relative` (normalize.css, Tailwind preflight), measured in
  place and verified against the rendered lines; visually hidden text (the
  sr-only pattern, clip-path variants included) and `aria-hidden` elements
  with no width, as zero-width atoms that no generated break falls inside
  and that measurement, spacing and tracking leave out. `'core'`, the
  default, leaves a block with any of them native, as 4.3.1 did. Still
  native under both:
  `br`, `img`, `svg`, `q`, `bdi`, a visible `aria-hidden` icon, `::after`
  link icons and `vertical-align: top`.
- Up to three Greek or Cyrillic letters in a row inside Latin text ("5 μg/mL",
  "α-synuclein", "ΔG", "ПЦР") compose under both coverage values; a Greek
  sentence, a Cyrillic word or four such letters in a row keep the block
  native (`native:script`).
- React 18.2 and later, and every React 19 minor (optional peers `react` and
  `react-dom`, `^18.2.0 || ^19.0.0`).
  `scripts/v4/verify-react-matrix.mjs` installs the packed package beside
  18.2.0, 18.3.1, 19.0.8, 19.1.9, 19.2.8 and 19.3.0, then server-renders,
  hydrates and composes both adapters in Chromium, WebKit and Firefox, and
  type-checks against @types/react 18.3, 19.0 and latest. Next acceptance
  requires a real packed consumer build with the version recorded.
- Chromium, WebKit and Firefox through Playwright. Reports record versions;
  no untested historical minimum is inferred.
- Intl.Segmenter, ResizeObserver, MutationObserver and a layout engine are
  required to compose. Where one is missing (jsdom and happy-dom under Jest or
  Vitest, older engines), every entry still imports, text stays native and
  the outcome is `native:environment`; nothing throws. document.fonts is
  optional. The library has no Node requirement and the package declares no
  `engines` field, so no package manager refuses it. The `typeset-audit` CLI
  needs Node 18.3 or later (its help and argument parsing run on 18.3.0 and
  18.20.8; full audits are tested on Node 22 and 24) plus Playwright, which
  has its own Node floor.
- ESM and CommonJS for both the core and the React entry (`react.cjs` for
  `require()` and Jest); script-tag builds with typed globals (`./global`,
  `./go`) and the automatic loader (`./auto`).

Prefer the React adapters for text React renders. From 4.3, mount() and the
website loader also keep framework-updated text correct: when a framework
writes to or removes a Text node the engine split (Svelte, Vue, Solid, Lit and
React set .data or .nodeValue on the node they created), the stale fragments
are removed before the next frame and the paragraph recomposes; disconnect()
leaves exactly the framework's text. Author Text nodes that Solid or Lit find by
position, and React's, stay in place (emptied, with their text wrapped next to
them) instead of moving into tracking wrappers; nothing goes between a comment
and the Text node after it (Lit starts each item of an array, map() or
repeat(), and a top-level render(), with an empty comment and writes to the
node after it), and such a node keeps its text, unwrapped. So the line that
holds such text is not letter-spaced (the paragraph's other lines are; with
none left, tracking reports `native:tracking-comment`); this also applies to
static HTML with React's server-rendering separators (`<!-- -->`) or
WordPress's `<!--more-->`, while hydrated React text is tracked.
`verify-framework-text.mjs` runs a hand-rolled renderer, React 19, Svelte 5,
Vue 3.5, Solid 1.9 and Lit 3 (template parts, and iterables with a top-level
render()) through twenty updates each in three engines. Limits: direct
typeset() and restore() without a controller see edits only by value, so an
emptied node set to '' again is not noticed; the legacy .ts-line renderer
(lineBreaks: 'legacy' on plain text) copies text and never sees framework
writes. `TypesetRichText` with any component child (next/link's `<Link>`,
a router link, a function or class component) stays native
(`native:react-component`); its children must be text and host elements.
Unsupported CSS/scripts, automatic/soft hyphens and editable content remain
native. So does a block with a descendant in a language written in another
script (a Japanese phrase in English text: `native:mixed-language`); a
descendant in another Latin-script language (`<span lang="es">`,
`lang="en-GB"` inside untagged text) leaves the block
`native:mixed-language` under the default, `'core'`, and is part of the
paragraph and set with the block's preferences under
`coverage: 'extended'`. Native text may have authored
overflow or an orphan: fallback means declined intervention, not perfection.

Justified text remains native and reports `native:justify`: a generated break
ends its line, so each composed line would take the last-line alignment. This
covers a computed `text-align` of `justify` or `justify-all`, and any
`text-align-last` that differs from `text-align`. Composition does not justify
text; it composes left, centred and right-aligned text.

4.2 supports ordinary nonwrapping inline phrases in otherwise wrapping rich
text. Internal no-break boundaries survive styled descendants and composition;
an overlong protected phrase is reported as an unbreakable-run constraint.
Preserved whitespace (pre/pre-wrap/break-spaces) remains outside this path.
Capitalized English name/designator groups receive a bounded preference when
they fit. This is not a general semantic parser or recognition of arbitrary brands.

Mount ownership is coordinated per target within a shared engine instance.
The first claim owns composition; waiting mounts do not write or restore that
target and may take over after release. Read stats.overlappingTargets. Continue
to use disjoint target selectors and one version; nested text owners and separately
bundled engine copies are not made safe by this same-instance safeguard.

Word-spacing finishing applies to composed, left-aligned body text. Its delta
is bounded to -20%/+33% of each run's measured natural space; existing authored
tracking/word spacing is preserved. Large out-of-reach contractions are skipped.
Title layout and native-retained paragraphs are unchanged. Empty, aria-hidden
space markers do not alter source characters, links, emphasis or final lines.
CSS that decorates or resizes those markers causes a verified unspaced fallback.
Audit feature outcomes distinguish that fallback from successful finishing.

Default Unicode body rendering adds verified per-line letter tracking after
word spacing, bounded to +/-0.01em of each eligible run's authored value.
Reversible wrappers cover contiguous styled text runs, not individual letters;
original links/emphasis retain identity. Word spacing compensates for tracking's
space contribution. Final lines and chosen source spans stay unchanged.
Code/kbd/samp, joining scripts, unresolved relative spacing and more than 256
runs retain untracked rendering. Legacy plain rendering does not use this pass.
Tracking failure rolls back tracking only; it is not silently reported applied.

Ordinary inline code with normal whitespace, emergency overflow-wrap:break-word
and nonnegative sliced padding/borders/margins is measured with its surrounding
text. Unsupported box decoration remains native. Identity and pure 2D translation
transforms are supported; text is not composed under scale, rotation,
perspective or nonzero Z, though a composition made before such a transform
is kept while it applies.

Smart quotes are explicit English, quotes-only. `smartQuotes: 'en'` curls
quotes in declared English and untagged text; `'en-declared'` (new in 4.4,
and the automatic loader's default) only where the element or an ancestor
declares `en` or `en-*`, so an untagged German or French page keeps its
quotes. `data-typeset-smart-quotes="en"` gives the loader 4.3's behaviour. A
double quote with white space or the text's edge on both sides (French
spaced quotes), or with no open quotation to close (`width="100"`), stays
straight; primes after a number (`5'10"`) and elisions are curled as in
4.3.1. Each quote keeps its kind:
single quotes are never turned into double quotes, or the reverse. From 4.3
TypesetText curls them during render, so server HTML already has them;
TypesetRichText does so only with lang="en" (or en-*) on the component itself,
since render cannot see an ancestor's lang, and warns in development builds
when it is missing; with `'en-declared'` both adapters need `lang` on the
component. Educated quotes stay in every state, not only in composed
lines: text that declines, shows native wrapping while its width changes
(`data-ts-stale`), waits offscreen or is kept native because a
TypesetRichText child is a component (the text it passes to that component
is educated too) shows curly quotes, and copies them. Optical hanging applies to
eligible left-aligned leading glyphs, not indented/centered or justified contexts.
Clipped containers are supported only when the full glyph's measured geometry
fits the available clip, padding and scrollport. Rounded clips are conservative;
unknown clip paths/masks decline. No overflow CSS is overridden. Partial
application is reported when only some lines fit. It does not increase solver width, permit right overflow,
or change chosen source line spans. List styling uses external CSS and native
::marker. Compose leaf prose separately from lists containing nested lists.

Capital alignment samples the actual font's rasterized left contour relative
to its upright H, bounded to 0.08em. Opening punctuation uses its full measured
DOM advance. The canvas and DOM advance must agree within the browser's
single-character rounding envelope. Unsupported custom font-feature/variation
settings and unavailable ink measurements report `native:hanging-font`; no
fixed per-letter offset is substituted. Standard variable-font weights selected
through font-weight use the browser's font rendering. Optical geometry is
verified after render, including React's native-fitting single-line path.
For example, custom font-feature-settings: "onum" currently retains
native:hanging-font even where the clip geometry itself is supported.

Every composed line is checked for its source span and actual fit. Existing
native overflow is never extra room for a newly composed line. The 0.5px
layout rounding allowance remains; fallback is reported instead of presenting
unprocessed native text as successful composition.

Live regions stay native: from 4.3, text inside aria-live (unless the nearest
region says off; an empty aria-live counts as absent, and any other value as
live, as Chromium treats it), role status, alert, log, marquee or timer, or
<output>, and text that contains such a region (a paragraph with an inline
result count or "saved" status), is never composed, measured or rewritten,
because assistive technology announces every change there. Its outcome is
`native:live-region`. Composed text moved into a live region, or given one,
is released in the same mutation callback as that change. `TypesetText` in a
region keeps the quotes it curled while rendering. Regions count through open
shadow roots as assistive technology sees them: text slotted into a
component's live wrapper (a design system's toast or alert that puts
`role="status"` around a `<slot>`), a paragraph containing a component whose
slot is live, and text inside a shadow root under a live region, as these
are when the text is composed. No mutation reaches the page when a shadow
tree changes later: a component defined after the text composed (a lazily
loaded toast whose shadow root wraps the slot in `role="status"`), or a role
set inside a shadow root afterwards, is seen at the next resize, font load
or pass, which releases the text inside the now-live region with one extra
update (a light-DOM change is released with the change itself). Mark such
text `data-no-typeset`, or keep undefined components hidden with
`:not(:defined) { visibility: hidden }`, which leaves them uncomposed. A
role or `aria-live` a component sets through `ElementInternals`, or inside a
closed shadow root, cannot be read from outside the component: mark such
text `data-no-typeset`.

Strict Content Security Policy: from 4.3 the engine needs no 'unsafe-inline'
for styles and no 'unsafe-eval'. It writes and restores styles through the
CSSOM only, never the style attribute, injects no <style> element (its print
and resize rules are a constructable stylesheet) and uses no HTML sink, so it
also runs under require-trusted-types-for 'script' with trusted-types 'none'.
Allow the origin that serves the script. 4.2 restored its measurement styles
through the style attribute, which such a policy refuses: paragraphs kept
white-space:nowrap in Chromium and WebKit, and Firefox erased author CSSOM
styles. `scripts/v4/verify-strict-csp.mjs` runs typeset, recomposition,
restore, copy, go.js and both React adapters under that policy in three
engines.

Generated line breaks are displayed through the custom property
`--ts-break-display` (default `inline`). In print it is `none`, so printed text
wraps natively at the paper's width; set `--ts-break-display: inline` on a
composed element in print CSS to keep its composition. While a block's width is
changing and it is narrower than its widest composed line, the engine marks it
`data-ts-stale` and shows native wrapping until it is recomposed: 100 ms after
the size holds for text within about a viewport height of the screen, and for
text further away (with `mount()` and the loaders) once it comes that near. That
offscreen text is released to native in idle time meanwhile, so no engine
marker is left beside a hidden break for assistive technology to join words
at; its outcome is kept. A width change a composition makes itself is not a
resize: a block in a box sized by its content (a flex item without `flex: 1`
or `min-width: 0`, `width: fit-content`, `inline-block`, a float, an auto
table cell or grid track, an absolutely positioned box or dialog without a
width) narrows that box to its composed lines and keeps them. `mount()`, the
loaders and the React adapters also keep a composed block whose lines still
fit when only compositions moved it (another block's, in two auto grid tracks
or two table cells). With `mount()`, the
loaders and both React adapters, a page of these layouts makes no DOM change
from 2 s after it loads or a resize ends, at 320, 375, 424, 492, 728, 768 and
1280 px in Chromium, WebKit and Firefox (`scripts/v4/verify-settle.mjs`). Both hooks are supported; the engine installs their rules
as a constructable stylesheet, and `dist/styles.css` carries them for engines
without one. A page that assigns `document.adoptedStyleSheets` (a theme
switcher) drops that sheet; the engine adds it back as printing starts,
before it marks a block stale and on each composition pass. Hidden text (display:none, the hidden attribute, a closed dialog,
content-visibility) keeps its composition and is not measured until shown.
Text that is hidden while the window's width changes shows native wrapping
until it is shown and recomposed, since it will likely be shown at another
width.

Composed text follows text metrics as well as width: fonts that finish
loading (including fonts a stylesheet requests late, for which WebKit fires
no event), the WCAG 1.4.12 text-spacing overrides, a browser font-size
setting, CSSOM rule changes and transitions or animations of font, spacing
or line-height properties. A block whose height changes at the same width
has its rendered lines checked against its composition, and `auditJSON()`
reports `stale-layout` for a composed block whose line count no longer
matches. Ancestor class and style changes recompose only when a computed
layout key (fonts, metrics, width, effective scale and zoom) changes. A
transform on an ancestor (a drawer that scales the page behind it, a hover
scale) moves no line, so a composition made before it is kept; text that
could not be composed while a transform applied (`native:transformed`, such
as a dialog's `@starting-style` scale-in or a card inserted with
`element.animate()`) is composed again when the transform's transition or
animation ends. With the React adapters, a block whose text metrics keep
changing (a font-size or spacing transition, a text-size slider) shows native
wrapping until they hold for 100 ms, then composes once, instead of
composing in every frame. A change counts as continuous when it comes within
100 ms of the block's last composition, or, on screen, within two rendering
updates of a composition that itself followed such a change; the adapters'
own work, which on a slow device can outlast 100 ms, is left out of both
windows. A one-off change later than that composes.
`mount()` also works on the document or elements of a same-origin iframe.
The React adapters share one registry per document, with the same
triggers (a host whose height changes at the same width has its layout key
compared), one set of observers however many blocks render, and
visible-first composition (`priority="sync"` composes in the commit).

Machine translation: when a page is translated (Google Translate and Chrome set
`translated-ltr`/`translated-rtl` on `<html>`; translators wrap text in `<font>`;
Edge adds `_msttexthash`), `mount()` and `typeset()` step aside with outcome
`native:translated`, moving but never splitting, merging or removing the Text
nodes the translator fills, and compose the current DOM again when the
translation ends. Before that composition they merge the Text nodes they had
split and put straight quotes back, wherever the translator left those nodes
as they were, so a framework's next write to its own node and a later
`restore()` or `disconnect()` start from the author's text. `TypesetRichText` only freezes: the breaks React rendered
remain, so a translation of that text is read per line. `TypesetText` steps
aside like `mount()`.

Server-rendered pages (the loaders, from 4.4). On a page with a
server-rendering marker (`#__next`, `#__NEXT_DATA__`, `self.__next_f`,
`#___gatsby`, `[data-framer-hydrate-v2]`, `astro-island`,
`[data-server-rendered]`, or a React root on the document, the body or a
child of the body), the automatic and opt-in loaders wait for the framework
before their first composition: React, until each server-rendered target
(or an ancestor below the body) is hydrated; Astro, until no
`astro-island[ssr]` is left apart from `client:visible` and `client:media`
islands; Vue 2, until no `[data-server-rendered]` is left; then one idle
callback (a 50 ms timer where there is none), for at most 10 s. A paragraph
composed before React hydrates it no longer matches the server HTML, and
React 18 and 19 then report recoverable hydration errors (#418, and in 18
#425 and #423) and render the root again on the client. In a Chromium probe
(an SSR article hydrated 300 ms after the client script, with `<div
id="__next">`), React 18.2.0 and 19.3.0 logged no error, kept the server
node and composed after hydration. `data-typeset-defer="hydration"` waits
without a marker (see Known limitations for Wix);
`data-typeset-defer="none"` composes at DOMContentLoaded, as 4.3 did. Without a marker the timing is 4.3's. The text paints with the
browser's wrapping until the first composition, and `window.TypesetReady`
resolves after it. The React adapters and `mount()` called in an effect run
after hydration and need no wait.

`whenSettled(options?: { timeout?: number })`, from 4.4 in `typeset.us`,
`typeset.us/react` and `window.Typeset`, resolves `{ settled: true }` once
every `mount()` controller and every React adapter host has its outcome, no
composition work is queued or timed, no web font is loading and a loader
waiting for hydration has composed, at two checks 50 ms apart, and
`{ settled: false }` if work remains at the timeout (default 10,000 ms).
Under jsdom and happy-dom it resolves at once. Engine copies on one page
(the CommonJS and ESM entries, a script-tag loader beside an npm import)
share one list of work. It does not wait for hosts React has not mounted
yet (a pending Suspense boundary), for a finite CSS animation to end, or for
offscreen blocks a resize left native until they are scrolled near.

`headings` (default `true`): `headings: false`, or
`data-typeset-headings="false"` on the loaders, makes `mount()`,
`typesetAll()` and the loaders leave `h1` to `h6`, `[role=heading]` and
anything inside them untouched, with no outcome written; `typeset(el)` still
composes the element it is given. A heading that wraps has a generated
break inside it, which iOS VoiceOver may read as two items; this has not
yet been checked by ear. `copy` (default `true`): a document copy handler
puts the source text on the clipboard, without the generated line breaks,
and yields to copy handlers the page registered first. `copy: false`
(`data-typeset-copy="false"`, `copy={false}` on the adapters) leaves an
element's copying to the browser, whose copied text then has a line break
at every composed line end; the handler is installed only when some
composed element has copy on.

Entry points. `typeset.us/auto` (`dist/auto.js`) is the automatic loader,
byte for byte the website's `go@<version>.js`. `typeset.us/opt-in`
(`dist/go.js`, from 4.4) composes only `[data-typeset]` or
`data-typeset-selector`; `typeset.us/go` is the same file and types, a
deprecated alias kept until at least 5.0. The package's `jsdelivr` and
`unpkg` fields name `dist/auto.js`, so the bare
`https://cdn.jsdelivr.net/npm/typeset.us` URL serves the automatic loader
(4.3 served `dist/typeset.global.js`, which composes nothing by itself).
typeset.us hosting has no uptime guarantee; the npm package and jsDelivr
serve the same files.

Audit review items new in 4.4: `clipped` (an element whose overflow is
`hidden` or `clip` with `text-overflow: ellipsis` or `-webkit-line-clamp`,
reported instead of an `overflow` error), `untagged` (composed text with no
`lang`, so English line-end preferences are off) and `uncomposed` (nothing
in scope composed, for a reason other than nothing to improve, including
`native:environment` under jsdom). Review items never fail the gate; `pass`
and `schemaVersion` 1 are unchanged. `typeset-audit` prints one
`typeset-audit: warning:` line on stderr for `uncomposed`, with the same exit
code. After their first pass the loaders log at most two `console.info`
lines, never a warning or an error, for the same two conditions as
`untagged` and `uncomposed`.

Errors and warnings. For anything that is not an element, `typeset()` throws:
`TypeError: [typeset] typeset() expects an HTMLElement (received ...)`.
For a root that is not a document, element or selector, `mount()` throws:
`[typeset] mount() expects a Document, an Element or a selector string (received ...)`.
`mount('article p', options)` is
`mount(document, 'article p', options)`. In development builds (the ESM and
CommonJS entries when `process.env.NODE_ENV` is not `production`, and always in
`typeset.global.js` and `go.js`) invalid options print one `console.warn` each
and otherwise behave as before, for example:

- `smartQuotes must be "en", "en-declared" or false (received true)`
- `smartQuotes must be "en", "en-declared" or false (received "EN")`
- `coverage must be "extended" or "core" (received "full")`
- `spacing must be true or false (received "false")`
- `tracking must be true or false (received 1)`
- `opticalHanging must be true or false (received "yes")`
- `copy must be true or false (received "no")`
- `headings must be true or false (received "false")`
- `lineBreaks must be "unicode" or "legacy" (received "auto")`
- `contour must be "finished" or "natural" (received "smooth")`
- `mode must be "body", "heading", "title" or "ui" (received "para")`
- `density must be "compact" or "editorial" (received "loose")`
- `maxLines must be a positive integer (received 0)`
- `keep must be an array of strings (received "Oak Street")`
- `text must be a string (received 5)`
- `typeset() has no option "spcing"; it is ignored`
- `typeset() options must be an object (received "p")`
- `mount() selector must be a string (received an object)`

Production bundles drop these checks.

Outstanding independent acceptance: physical iOS/Android, spoken VoiceOver/NVDA,
non-macOS and native-application rich clipboard, and representative-device
repeated p95/long-task budgets. Emulation and synthetic clipboard events are
not substitutes. No universal flawless-results or speed claim is made.

Additional local coverage includes accessibility checks at two depths. A
DOM-derived snapshot (Playwright ariaSnapshot) compares composed and native
text; it normalises whitespace, so it cannot see words an engine's own
accessibility tree joins. `scripts/v4/verify-native-ax.mjs` reads the engines'
trees: Chromium's full tree through CDP (every composed block's words, and every
link and heading name), WebKit's accessible names for links and headings
through its inspector protocol, and Gecko's tree through Marionette in a nightly
lane, at 320, 375 and 768 px. The 4.2.0 build fails these checks: its hidden
generated line breaks join the words on either side of each break, including
inside link and heading names, and Chromium also drops some word spaces beside
spacing markers. `auditJSON()` reports both conditions as `hidden-break` and
`isolated-space` errors. From 4.3, a generated break that stands in for a space
is exposed, so assistive technology meets a line boundary there (WebKit names
contain a newline), a break after a hyphen stays hidden, and spacing and
hanging markers are empty, hidden and `display: inline`. Local coverage also includes keyboard navigation,
emulated touch/rotation, 200%/400% text sizing,
delayed variable fonts, source updates and no-JavaScript rendering. The macOS
clipboard suite uses headed Chromium/WebKit/Firefox, trusted copy/paste events
and the native NSPasteboard, including cross-paragraph and partial selections.
It covers plain text and HTML pasted into browser editors, not Word/Pages,
mobile selection handles, Windows clipboard, or spoken screen-reader output.
Cross-paragraph copying retains native paragraph/authored-break boundaries;
generated line breaks and engine metadata (data-ts and adapter attributes, and
the engine's text-wrap-style override, replaced by the author's own inline
value) are excluded. Relative copied links
resolve against the source page. Site copy handlers retain precedence. From
4.3 the copied HTML and text also leave out what the browser's own copy
leaves out: display:none and content-visibility:hidden content, hidden inputs,
script, style, template and noscript, and visibility:hidden text.

At extreme text sizes, an unbreakable word can exceed the authored column.
That remains a reported overflow, never a passing audit. Typeset does not
shrink text or silently add word splits. Authors can opt into native emergency
wrapping with overflow-wrap:anywhere; this intentionally retains native layout
with native:break-policy. Text-size stress tests are not OS zoom certification.

The release owner accepted these documented external-testing limitations.
A clean local Node 22 workflow or CPU throttle must never be labeled remote
CI or representative-device proof. Pilot within your actual site and devices.

No install hooks, telemetry, page-content uploads or required runtime service.
Mount's incremental discovery, visible-first scheduling (text near the
viewport composes in the next task, offscreen text in idle time or when it
comes near) and yielded batches reduce redundant work. The React adapters
compose offscreen blocks in long idle periods; when the browser stops giving
the page idle periods (Chromium can, for seconds, once its frames stop), the
remaining blocks compose in animation frames, 12 ms a frame, until idle
periods return (from 4.3.2). Real text, font,
metric and width changes still recompose. The 8ms batch target cannot
preempt one paragraph or a browser layout.
Large-document discovery/layout can still create long tasks. Benchmarks of a
static snapshot of a client site are not live hydration, server, or
physical-device proof.
The audit CLI navigates only your explicit URL and reports locally; --apply
changes only an isolated preview, never a deployed site.

## Known limitations

- **Generated line breaks are real `<br>` elements.** Find-in-page does not
  match a phrase that spans one, a Text Fragment link (`#:~:text=`) to such
  a phrase does not scroll, and `innerText` and `selection.toString()`
  contain a newline at each. Copying through the browser's copy command is
  cleaned (no extra newlines), and the source text in the DOM is unchanged.
  A newline-free rendering is on the roadmap.
- **Reader views keep the composed lines.** A reader view that extracts the
  live page (Firefox's Reader View, and read-later tools built on Mozilla's
  Readability that capture the rendered DOM) keeps each generated break,
  which since 4.3 is exposed to assistive technology rather than
  `aria-hidden`, but not its style, so it shows the page's composed lines
  inside its own wider column and larger type: alternating long and short
  lines, or a narrow ragged column when the page was composed for a phone.
  Measured with Firefox's own Readability.js on 40 corpus paragraphs
  composed at 375 px and read at a 660 px measure: 35 double-wrapped
  (1024 px composition: 36); 4.2.0, whose breaks were `aria-hidden`: 0. The
  text itself is complete. Services that fetch the server's HTML are
  unaffected: nothing is composed there. Chrome's accessibility-tree-based
  Reading mode may also see a line break at each; this was not measured.
- **Print.** Printed text wraps natively at the paper's width: in print,
  `--ts-break-display` is `none` and spacing, hanging and tracking are
  neutralized, and composition pauses until printing ends. Set
  `--ts-break-display: inline` on an element in print CSS to print its
  screen composition instead. 4.2.0 printed the screen breaks, which the
  narrower page re-wrapped into alternating long and short lines.
- **Widths seen only after layout.** A width change the engine cannot see
  before the browser lays out (a stylesheet rule, a composed block moved
  into a narrower container, text shown by CSS alone or by an attribute the
  engine does not watch, such as `aria-expanded`, after its container
  changed width while the window did not) can paint one frame of
  alternating long and short lines; from the next frame the block shows
  native wrapping (`data-ts-stale`) until it is recomposed.
- **Far text brought on screen by a jump.** Text more than a viewport
  height below the fold (of the window, or of the pane it scrolls in)
  composes in idle time, so it never costs a frame of a screen push or a
  scroll. A jump that brings it on screen before then (a scrollbar drag,
  End, an anchor link, one large wheel delta soon after a load, or while an
  animation keeps frames pending) paints its native lines for one frame and
  rewraps in the next. With the React adapters, `priority="sync"` composes a
  block in its commit instead. Not addressed in 4.4.
- **Offscreen text under a wrapper that scrolls horizontally.** Nearness
  is measured against the nearest ancestor that scrolls on either axis. An
  app root with `overflow-x: hidden` (its `overflow-y` then computes to
  `auto`) or a horizontal carousel row is such an ancestor, so every block
  in it counts as near however far below the fold, and during a screen
  transition those blocks compose in animation frames rather than in idle
  time, which can drop frames on a slow device. In WebKit, when the cards
  in such a carousel run a CSS entrance animation, about half of them
  decline as `native:verification` and keep the browser's own line breaks
  (23 of 48 in the test fixture; 4.2.0 composed 47). The text is always
  correct: each block paints its composed lines or native ones, never
  double-wrapped. On an app root, `overflow-x: clip` clips the same way
  without making a scroll container. Not addressed in 4.4.
- **Text scrolled on screen in the frame after it mounts, below a full
  first frame.** Before the first paint, `TypesetText` and
  `TypesetRichText` compose the blocks on screen, then those within a
  viewport height below the fold (of the window, or of the pane they scroll
  in) while the frame's 12 ms budget lasts. A page that scrolls from its own
  `requestAnimationFrame` right after mounting moves text after that work,
  so a block just below the fold that the budget left for the next frame
  paints its native lines for one frame and rewraps in the next. In the
  test fixture (a 700 px pane scrolled 80 px a frame from the frame after
  mounting) that happens in every run in all three engines when five
  blocks are on screen, and in none when one is; scrolled after a 0 ms
  timer, in none either way. 4.3.0 did it in every run from the frame after
  mounting, sometimes to a second block, and in some runs after a 0 ms
  timer (Chromium; every run on GitHub's macOS runners in WebKit).
  `priority="sync"` composes a block in its commit instead. Not addressed in
  4.4.
- **A very long unbreakable run, in WebKit.** Measuring a paragraph reads
  each word's boxes, and a word the browser splits across lines is read one
  character at a time, so that each character counts on its own line.
  WebKit's `Range.getClientRects()` takes time in proportion to the length
  of the line the range is on, so a word whose first line holds thousands
  of characters costs the square of that length. A paragraph with 11,000
  consecutive closing quotes (U+201D) followed directly by a letter, which
  WebKit may break before, takes about 37 s in `typeset()` in WebKit
  (4.2.0: 50 to 90 s), and one with 11,000 letters then a hyphen and a
  letter about 15 s (Chromium 1.4 s, Firefox 0.2 s; the quotes take under
  0.1 s in both). Both are under the 12,000-character budget. Prose has no
  such runs, but untrusted text (comments, profiles) can use one to freeze
  a Safari tab. From 4.4, a block with more than 500 code points
  (collapsible white space aside) between two line-break opportunities
  keeps the browser's layout as `native:run-budget` before any box is read;
  a run of exactly 500 is not declined. `typeset()` on the same two
  paragraphs at 600 px, 18px Georgia, 4.3.1 against 4.4: WebKit 24,842 ms
  and 9,904 ms against 18 ms and 8 ms; Chromium 29 ms and 1,328 ms against
  19 ms and 7 ms; Firefox 33 ms and 156 ms against 24 ms and 10 ms. There
  is no opt-out: it is a safety limit. Also set `overflow-wrap: break-word`,
  which Typeset supports, on containers of user-generated text, so such a
  run wraps at the measure (in 4.3, the same two paragraphs then took 0.8 s
  and 0.5 s); or leave such text out of composition (`data-no-typeset`, or a
  selector that does not match it).
- **Machine translation.** While a page is translated (Google Translate and
  Chrome set `translated-ltr`/`translated-rtl` on `<html>`, translators wrap
  text in `<font>`, Edge adds `_msttexthash`), `mount()`, the loaders,
  `typeset()` and `TypesetText` remove their breaks and wrappers by moving
  the existing Text nodes, never splitting, merging or editing one, report
  `native:translated`, and compose the current DOM again when the page
  returns to its original language. `TypesetRichText` only freezes: the
  breaks React rendered stay, so its translated text still breaks at the
  composed positions. Because the Text nodes are moved and never merged, the
  translator receives a composed paragraph as many Text nodes, and Google
  Translate sometimes joins those segments with a stray space before
  punctuation ("dijo ,"): 3 of 9 test paragraphs in a live English to
  Spanish check, in all three engines, where the uncomposed page had none.
  No text is lost, and showing the original restores the source exactly:
  the split Text nodes are merged and curled quotes straightened again
  before the text is composed once more (where the translator changed a
  node, it is left as it is).
  A word space beside a removed break is moved in place as well, so a
  Chromium accessibility tree that was live before the release (a screen
  reader running) reads it; `scripts/v4/verify-native-ax.mjs` checks that
  lane in Chromium and Firefox. WebKit's accessible names join the words at
  any soft wrap that falls between two Text nodes (plain DOM does the same),
  so while text is released a link or heading name there can read two words
  as one where a line wraps at a former break.
  No network smoke test against a live translator runs in the suite; the
  offline suite simulates each translator's marks. Safari's and Firefox's
  built-in translators are not among those detected, and composed text has
  not been tested with them. WebKit's text
  manipulation API, which Safari's translation is believed to use, treats
  a `<br>` as the end of an item, so a composed paragraph may reach it as
  one item per line.
- **Content Security Policy and Trusted Types.** The 4.x composition path
  (`mount`, `typeset`, the loaders and the React adapters) assigns no HTML
  strings, uses no `eval`, injects no `<style>` elements and writes styles
  only through the CSSOM. It runs under
  `style-src 'self'; script-src 'self'; require-trusted-types-for 'script'; trusted-types 'none'`
  with no violation in Chromium, WebKit and Firefox
  (`scripts/v4/verify-strict-csp.mjs`). The retained v3 helpers are not part
  of that path, although `renderFrozenLines` also runs under Trusted Types
  from 4.3.
- **No hyphenation, no justification.** Text with `hyphens: auto` or soft
  hyphens keeps the browser's layout, and so does justified text (a computed
  `text-align` of `justify` or `justify-all`, or a `text-align-last` that
  differs from `text-align`), which reports `native:justify`.
- **Indented paragraphs** keep the browser's layout: a paragraph with any
  `text-indent`, including a book-style first-line indent (`p + p {
  text-indent: 1.5em }`, which leaves every paragraph after the first
  native) and a hanging indent, reports `native:rich-whitespace`, as in
  4.2.0. `lineBreaks: 'legacy'` does not decline an indent (neither did
  4.2.0): depending on what was measured before it, an indented paragraph
  or heading can be composed with the indent repeated on every line.
- **Right-to-left, vertical and non-Latin text** keeps the browser's layout
  (up to three Greek or Cyrillic letters in a row inside Latin text
  compose). Under the default, `coverage: 'core'`, so does text declared in
  a Latin-script language other than English, French, German and Spanish;
  `coverage: 'extended'` composes it.
- **Browser floor.** Composes where `Intl.Segmenter`, `ResizeObserver` and
  `MutationObserver` exist; the supported browsers also have CSS
  `text-wrap`: Chrome and Edge 114, Safari 17.4 and Firefox 125, or later. Elsewhere, and in DOM emulations such as jsdom and
  happy-dom, every entry point imports and the text keeps its native layout
  with `native:environment`; nothing throws. Tested in Playwright's
  Chromium, WebKit and Firefox, and with those APIs deleted; the versions
  are in each report.
- **Hydration wait.** A marked page whose framework never hydrates composes
  when the 10 s cap runs out, and so does one where a third-party script
  adds paragraphs inside a React root before DOMContentLoaded. Wix pages
  carry no marker in the list and keep 4.3's timing unless the script tag
  has `data-typeset-defer="hydration"`, which waits for React only when its
  root exists by the load event. `[data-framer-hydrate-v2]` has not been
  checked on a live Framer site.
- **Framework-owned text.** `mount()` and the loaders keep text that Vue,
  Svelte, Lit, Solid or React update in place correct (see above for how and
  for the limits). Direct `typeset()` and `restore()` calls without a
  controller notice edits only by value, and the legacy `.ts-line` renderer
  never sees framework writes. Prefer the React adapters for text React
  renders, and never give one text two owners.
