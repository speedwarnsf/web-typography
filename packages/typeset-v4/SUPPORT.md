# Typeset 4.3.0 support contract

4.3.0 is released with owner approval within the range below. Local tests
are not certification for every device, browser, font, or sentence.
What each outcome means: OUTCOMES.md. What a version promises: STABILITY.md
in the repository.

- Horizontal LTR Latin prose/titles; declared English, French, German and
  Spanish. Untagged Latin uses neutral preferences.
- Ordinary inline links, bold, italics and supported semantic spans. Author
  elements are not cloned/reparented by the imperative rich renderer.
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
them) instead of moving into tracking wrappers. `verify-framework-text.mjs`
runs a hand-rolled renderer, React 19, Svelte 5, Vue 3.5, Solid 1.9 and Lit 3
through twenty updates each in three engines. Limits: direct typeset() and
restore() without a controller see edits only by value, so an emptied node set
to '' again is not noticed; the legacy .ts-line renderer (lineBreaks: 'legacy'
on plain text) copies text and never sees framework writes; Lit text in arrays
or nested templates is moved into wrappers as in 4.2. Stateful custom React
children remain native. Unsupported CSS/scripts, mixed-language blocks, automatic/soft
hyphens and editable content remain native. Native text may have authored
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
transforms are supported; scale, rotation, perspective and nonzero Z are not.

Smart quotes are explicit English, quotes-only. Each quote keeps its kind:
single quotes are never turned into double quotes, or the reverse. From 4.3
TypesetText curls them during render, so server HTML already has them;
TypesetRichText does so only with lang="en" (or en-*) on the component itself,
since render cannot see an ancestor's lang, and warns in development builds
when it is missing. Optical hanging applies to
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
region keeps the quotes it curled while rendering.

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
`data-ts-stale` and shows native wrapping until the size has held for 100 ms
and it is recomposed. Both hooks are supported; the engine installs their rules
as a constructable stylesheet, and `dist/styles.css` carries them for engines
without one. Hidden text (display:none, the hidden attribute, a closed dialog,
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
layout key (fonts, metrics, width, effective scale and zoom) changes.
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
translation ends. `TypesetRichText` only freezes: the breaks React rendered
remain, so a translation of that text is read per line. `TypesetText` steps
aside like `mount()`.

Errors and warnings. For anything that is not an element, `typeset()` throws:
`TypeError: [typeset] typeset() expects an HTMLElement (received ...)`.
For a root that is not a document, element or selector, `mount()` throws:
`[typeset] mount() expects a Document, an Element or a selector string (received ...)`.
`mount('article p', options)` is
`mount(document, 'article p', options)`. In development builds (the ESM and
CommonJS entries when `process.env.NODE_ENV` is not `production`, and always in
`typeset.global.js` and `go.js`) invalid options print one `console.warn` each
and otherwise behave as before, for example:

- `smartQuotes must be "en" or false (received true)`
- `smartQuotes must be "en" or false (received "EN")`
- `spacing must be true or false (received "false")`
- `tracking must be true or false (received 1)`
- `opticalHanging must be true or false (received "yes")`
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
comes near) and yielded batches reduce redundant work; real text, font,
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
- **Machine translation.** While a page is translated (Google Translate and
  Chrome set `translated-ltr`/`translated-rtl` on `<html>`, translators wrap
  text in `<font>`, Edge adds `_msttexthash`), `mount()`, the loaders,
  `typeset()` and `TypesetText` remove their breaks and wrappers by moving
  the existing Text nodes, never splitting, merging or editing one, report
  `native:translated`, and compose the current DOM again when the page
  returns to its original language. `TypesetRichText` only freezes: the
  breaks React rendered stay, so its translated text still breaks at the
  composed positions. No network smoke test against a live translator runs
  yet; the offline suite simulates each translator's marks.
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
- **Right-to-left, vertical and non-Latin text** keeps the browser's layout.
- **Browser floor.** Composes where `Intl.Segmenter`, `ResizeObserver` and
  `MutationObserver` exist; the supported browsers also have CSS
  `text-wrap`: Chrome and Edge 114, Safari 17.4 and Firefox 125, or later. Elsewhere, and in DOM emulations such as jsdom and
  happy-dom, every entry point imports and the text keeps its native layout
  with `native:environment`; nothing throws. Tested in Playwright's
  Chromium, WebKit and Firefox, and with those APIs deleted; the versions
  are in each report.
- **Framework-owned text.** `mount()` and the loaders keep text that Vue,
  Svelte, Lit, Solid or React update in place correct (see above for how and
  for the limits). Direct `typeset()` and `restore()` calls without a
  controller notice edits only by value, the legacy `.ts-line` renderer never
  sees framework writes, and Lit text in arrays or nested templates still
  moves into wrappers as in 4.2. Prefer the React adapters for text React
  renders, and never give one text two owners.
