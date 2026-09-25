# Changelog

`go@x.y.z.js` URLs are **permanent**. Once a version is published its bytes
never change and the file is never removed, so a pinned `<script>` with an
integrity hash keeps working forever. Upgrading means changing the version in
your tag; nothing upgrades under you.

Hashes for every published version live in
[`public/sri.json`](public/sri.json).

---

## 4.3.0 - Unreleased

4.3.0 follows 4.2.0. It is a minor release: no public API was renamed or
removed, nothing new is required, and new API is additive. Default rendering
changes only where 4.2.0 had a verified defect; each change is listed under
"Rendering changes" with the number of test paragraphs whose output changed.

### Rendering changes

Every count compares the published 4.2.0 build with the 4.3.0 candidate, in
the same pages, in Chromium, WebKit and Firefox:

- `scripts/v4/verify-golden.mjs`: 3,932 cells per engine (85 corpus
  paragraphs at 240, 320, 400 and 560 px in Georgia and the bundled Fraunces,
  plain, with a link and emphasis, with React's server-rendering comment
  separators, through the legacy renderer, with quotes and hanging, as
  titles and justified, plus a 33-paragraph adversarial set).
  A cell changes when its outcome, finishing features, breaks or characters
  differ.
- A golden A/B of 316 blocks per engine (audit fixture, 40 corpus
  paragraphs and React adapters at 320, 375 and 768 px, default and loader
  options): element screenshots at DPR 2, `measureLayout` line boxes,
  outcomes, feature statuses, copied text and HTML, and markup.
- The React adapters: 2,160 settled `TypesetText` and `TypesetRichText`
  blocks (60 corpus paragraphs, four configurations, 320, 390 and 560 px).

Outside the changes below, 0 of these differ in any engine.

- **Generated line breaks are word separators again (accessibility, C2).** A
  generated `<br>` that stands in for a collapsed space is no longer
  `aria-hidden`, so engine accessibility trees stop joining the words on
  either side of it ("galleryguide"), including inside link and heading
  names. A break after a hyphen or dash stays hidden, so "public-health" is
  still one word. Spacing and hanging markers are `display: inline` instead
  of `inline-block`, which stops Chromium dropping the word space beside
  them. The same applies to `TypesetRichText`. Assistive technology now meets
  a line boundary at each generated break, and WebKit accessible names
  contain a newline there. `scripts/v4/verify-native-ax.mjs` finds 0
  unmatched paragraph words in Chromium and Firefox (WebKit's inspector
  exposes no paragraph text) and 0 wrong link or heading names in Chromium,
  WebKit and Firefox, also after a narrowing resize and, in Chromium and
  Firefox, with a live tree across a translation. In the same lanes 4.2.0
  leaves 1,138 words unmatched in Chromium and 761 in Firefox, and 69 of 108
  link names and 41 of 42 heading names wrong in Chromium, 53 of 78 and 29
  of 30 in WebKit, and 56 of 108 link names in Firefox (on the original
  acceptance, corpus and React fixtures alone: 581 and 381 words, 38 of 63
  links and 23 of 24 headings). Attributes only: in the golden A/B, markup changed
  in 311 (310 in WebKit) blocks, and 1,087 of 1,103 generated breaks
  are now exposed (16 hyphen breaks stay hidden), with 0
  screenshots, line boxes, outcomes, feature statuses or copied texts
  changed. One effect reaches beyond the page: a reader view that extracts
  the live DOM (Firefox's Reader View, Readability-based read-later tools)
  drops `aria-hidden` nodes, so 4.2.0's breaks never reached it, and now
  keeps them without their style, showing the page's composed lines in its
  own wider column: with Firefox's Readability.js, 35 of 40 corpus
  paragraphs composed at 375 px are double-wrapped at a 660 px reader
  measure (36 composed at 1024 px; 4.2.0: 0). SUPPORT.md lists it under
  known limitations. In verify-golden 2,016 (WebKit 2,011) of 2,724 corpus cells per engine
  differ only in these attributes and C9's below, 173 of them also in the
  position of a break before a link (below).
- **Generated breaks are displayed through `--ts-break-display` (C9).** The
  break's inline style is `display: var(--ts-break-display, inline)
  !important` (4.2.0: `display: inline !important`), and the
  `TypesetRichText` break carries `display: var(--ts-break-display, inline)`.
  On screen nothing moves: the same cells as above change markup only. In
  print the property is `none` and spacing, hanging and tracking are
  neutralized, so printed text wraps natively at the paper's width, where
  4.2.0 printed the screen breaks and the page re-wrapped them into
  alternating long and short lines.
- **A line that starts where a link starts breaks before the link.** 4.2
  put the generated `<br>` first inside a link or other inline element whose
  text began the line, so the element's first fragment was an empty stub at
  the end of the line before: Firefox's default focus ring, author outlines
  and hover backgrounds painted a sliver there, a padded link's padding sat
  at that line's end, and WebKit link names began with a newline (16 to 19
  of 79 corpus links at 300 px). The break now goes before the outermost
  element that starts the line, in the DOM renderer and `TypesetRichText`
  (there also when the text before it ends inside another element or a
  fragment, as in `<strong>Note: </strong><a>`, where the first 4.3
  candidates still broke inside the link); the framework text an element
  holds is not split for it. Lines and
  characters are unchanged, and so are widths unless the element has
  horizontal padding, border or margin, which now starts its line as the
  compositor planned. Where the element that starts the line has other font
  metrics, such as inline `<code>`, 4.2.0's empty fragment also made the
  paragraph taller than the browser's own layout, by 1 px in Chromium and
  about 0.5 px in WebKit and Firefox; its height now matches native (a
  word of each corpus paragraph in `<code>` at 288 to 400 px: 134 of 1,476
  cells change height in Chromium, all by 1 px, 283 in WebKit, by 0.52 or
  0.05 px, and 287 in Firefox, by 0.5 px; 0 with `<em>`, whose metrics
  match). Golden diff: 173 of 680 rich cells per engine in
  verify-golden, 3 (WebKit 5) of 316 blocks in the golden A/B and 71 of
  2,160 React blocks, all markup only (the break's position), with 0
  screenshots, line boxes, outcomes or copied texts changed; 0 of the rest
  (these sets have no inline code at a line start).
- **The automatic loader composes `.demo` and `[data-no-smooth]` content.**
  The website loader (go@4.2.0.js, and 4.3's `typeset.us/auto`) always
  skipped elements with the class `demo` or the attribute
  `data-no-smooth`, and everything inside them, even under an explicit
  `data-typeset-selector`; these were typeset.us-internal exclusions that
  no document mentioned, and a page whose prose sat in a `.demo` container
  got nothing composed and a console note that nothing matched. From
  go@4.3.0.js they compose like any other prose; `data-no-typeset` remains
  the way to exclude content. Loader fixture: 2 of 2 such paragraphs now
  compose (0 under go@4.2.0.js); no typeset.us page that loads go.js uses
  either. The npm `typeset.us/go` never had these exclusions.
- **Lines holding text right after an HTML comment are not tracked** (C6).
  Frameworks find some Text nodes by their place after a comment (Lit's part
  markers, Solid's), so text right after any comment stays where it is,
  whole and unwrapped, and letter spacing, which needs a wrapper, is not
  applied to the line that holds it; the paragraph's other lines are
  tracked, and when none can be the status is `native:tracking-comment`.
  4.2.0 moved such text into its tracking wrappers. The first 4.3 candidate
  rolled tracking back for the whole paragraph instead, or tracked a line
  part way. This includes React's server-rendering separator (`<!-- -->`
  between interpolated strings in static HTML; hydrated React text is
  tracked as React's own) and WordPress's `<!--more-->`. Golden diff: in
  the new "comments" cells (43 corpus paragraphs with a separator at every
  fourth word), 314 (WebKit 312) of 344 differ from 4.2.0: 4.2.0 tracked
  287 (WebKit, Firefox 285), 4.3.0 tracks the comment-free lines of 106
  (WebKit 104) and reports `native:tracking-comment` for 181, and breaks
  and spacing markers go before a comment rather than between it and its
  text. Line breaks and characters are unchanged; 0 of the other cells
  change.
- **Justified text is left as the author set it** (`native:justify`, C3). A
  generated break ends its line, so every composed line took the last-line
  alignment: `text-align: justify` became ragged right, and a
  `text-align-last` that differs from `text-align` applied to every line,
  while `audit()` still passed. Multi-line paragraphs whose computed
  `text-align` is `justify` or `justify-all`, or whose `text-align-last`
  differs from `text-align`, are now declined under every entry point
  (`typeset()`, `mount()`, the loaders, `TypesetText`, `TypesetRichText` and
  the legacy renderer). A single line still reports `native:fits`. Golden
  diff: 336 of 336 justified cells per engine (42 corpus paragraphs), 0 of
  the rest.
- **Abbreviations, units, honorifics, labels and letter designators stay
  with their words** (English, C13). Every word ending in a period counted
  as a sentence end, so the compositor paid to break after "Dr.", "Fig.",
  "a.m." and "U.S.", and the single-letter penalty pushed units and
  designators to the next line ("1,200 / m", "hepatitis / C", "World War /
  I"). Now an abbreviation (Mr, Mrs, Ms, Mx, Dr, Prof, Rev, St, Mt, Jr, Sr,
  vs, etc, e.g, i.e, a.m, p.m, p, pp, Fig, No, Vol, Ch, Inc, Ltd, Co, dotted
  initialisms and single initials) ends no sentence unless a capitalized
  common sentence opener follows it ("…in the U.S. The results", "at 7 p.m.
  Most", "Plan B. It"); "etc." ends one before any capitalized word ("etc.
  Staff"), "a.m." and "p.m." before any but a day, a month or a time zone
  ("9 a.m. Parking", but "9 a.m. Monday"), and "No." before any but a roman
  numeral. Splitting a number from its unit, an honorific from a name, a
  label from its number, a word from its letter designator, or a capital
  letter after a function word from the lowercase word it modifies ("and B
  students", "the X chromosome") costs what a weak line end costs; and only
  the article and the pronoun "I" pay the single-letter penalty. "I" is a letter designator only after a
  head that takes a roman numeral ("World War I", "Phase I", "Title I") or a
  name after a regnal title ("King Henry I"), never after any other
  capitalized word ("In March I", "At Kaiser I"). Golden diff: 0 of 2,724
  corpus cells per engine (the corpus has none of these constructions); 63
  (Chromium, Firefox) or 64 (WebKit) of 264 cells of the new adversarial set
  (`tests/v4-corpus-adversarial.json`, 33 paragraphs), and 55 of 264 through
  the legacy renderer. On that set, line-end review items (the C16 audit)
  fall from 152 under 4.2.0 to 110 (WebKit 151 to 110), against 485 in the
  browser's own layout; pairs split at line ends fall from 60 to 21 (WebKit
  58 to 19). Openers stranded after "St." or an initial ("Main St. Doors",
  "vitamin K. Parents") are not charged, since those abbreviations often
  continue a sentence: 8 such line ends in the adversarial set where 4.2.0,
  which read every period as a sentence end, had none. The same holds after
  a dotted initialism, a company suffix or "Jr." that ends a sentence before
  a capitalized noun ("across the U.S. Health officials", "Novagen Inc.
  Shares", "King Jr. Organizers"), which reads as mid-sentence, and there
  4.3 strands the opener more often than 4.2.0 and than the browser: in a
  sweep of seven such sentences at 131 widths (280 to 800 px) in Georgia,
  Fraunces and Arial, the next sentence's first word ends a line in 483 of
  2,751 cells in Chromium (WebKit 478, Firefox 483), against 302 (300 in
  Firefox) in the browser's own layout and 51 (WebKit 50) under 4.2.0, 332
  (WebKit 339) of them where neither does. The C16 audit does not report
  these line ends. The four adversarial paragraphs added for them have 12
  (WebKit 11) such line ends (native 5, 4.2.0 2), and at 320 px in Fraunces
  "…across the U.S. Health" also adds a weak line end (a recorded
  trade-off). Telling the two readings apart needs a continuation list
  ("U.S. Army" against "U.S. Health"), left for 4.4. The binding is a
  trade, not a free win: across 105 widths (240 to 760 px) of the first 20
  of those paragraphs, split pairs fall by about 86% (797 to 113 in
  Chromium) while weak line ends rise by about 7% (554 to 591), because a
  split pair costs what a weak line end costs. Two recorded trade-offs at
  the golden widths: that "U.S. Health" paragraph, and at 320 px in
  Fraunces the recipe paragraph, which ends a line on "the" where neither
  the browser nor 4.2.0 does (the tight-line ranking, to be retuned in
  4.4). Dropping 4.2.0's false sentence
  ends also moves breaks where no pair is involved, since their penalties had
  steered some layouts: at the phone widths of 288 and 343 px, the review
  found 16 (Chromium), 21 (WebKit) and 18 (Firefox) changed cells without a
  split pair in 4.2.0 that now end one line on a weak or linking word 4.2.0
  avoided ("…audit by Ms. Lindqvist was | complete"); by the 4.3 audit, 450
  changed cells got better and 26 worse of 625 in Chromium. That retune
  goes to 4.4 with the tight-line trade. No orphan, overflow or text
  change.
- **Live regions are no longer composed** (accessibility, C4). Text whose
  nearest region has `aria-live="polite"` or `"assertive"`, or (without
  `aria-live="off"`) `role="status"`, `alert`, `log`, `marquee` or `timer`,
  or is an `<output>`, keeps native wrapping and reports
  `native:live-region`. 4.2 composed it and rewrote it on every resize, font
  load and idle pass (51 mutation records on mount and 180 more across two
  resizes for one status paragraph), and Chrome announced those rewrites, so
  screen readers repeated status messages. A paragraph that contains a live
  region (an inline result count or "saved" status) is declined the same
  way; an empty `aria-live` counts as absent and any other value but `off`
  as live, as Chromium treats them; composed text moved into a live region
  (a toast) is released in the same mutation callback as the move; and
  `TypesetText` in a region keeps the quotes it curled while rendering and
  writes a new value once, curled. Regions are found through open shadow
  roots as assistive technology sees them: text slotted into a component's
  live wrapper (a toast or alert with `role="status"` around a `<slot>`), a
  paragraph containing a component whose slot is live, and text in a shadow
  root under a live region, as they are when the text is composed. A shadow
  tree that turns live later sends no mutation (a component defined after
  the text composed, a role set inside its shadow root): the text is
  released at the next resize or font load, with one update inside the
  region (98 mutation records for a paragraph in three engines). Roles set
  through `ElementInternals` or inside a closed shadow root cannot be read
  from outside; SUPPORT.md gives `data-no-typeset` as the workaround for
  these and for lazily defined components. Golden diff: 9 of 13 paragraphs
  on the live-region fixture, per loader and engine (a paragraph that
  contains an `<output>` now reports `native:live-region`, not
  `native:rich-element`); 0 in the golden sets, which have no live regions.
- **Smart quote corrections (C15).** A single quote right after a curled
  opening double quote now opens too: `"'Quoted' inside,"` gives
  “‘Quoted’ inside,” (4.2 gave “’Quoted’). Rock ’n’ roll, ’bout, ’round and
  ’nuff are elisions (4.2 gave ‘n’ and ‘bout): 'n' only in a pair such as
  fish ’n’ chips, so a quoted key letter still opens with a left quote
  (“Type ‘n’ to cancel”), and 'round, 'bout and 'nuff only when no closing
  single quote follows in the sentence (“the ‘round robin’ plan”). Glyph
  substitutions only and length-preserving; ’90s, ’Tis, ’em, primes such as
  5'10" and possessives are unchanged, and single quotes never become
  double. Golden diff: 0 of
  173 corpus texts (14 with straight quotes). `TypesetText` also curls quotes
  during render, so its server HTML has them (a Next production build: 8
  curled, 0 straight, no hydration messages in three engines; 4.2 had 2 of
  10 curled before hydration).
- **Unrendered text is not measured** (C8). `typeset()` on an element in a
  `display: none` subtree keeps an existing composition (4.2.0 restored
  native text and recorded `unmeasurable`), and text in a skipped
  `content-visibility: auto` section records `unmeasurable` instead of being
  composed from forced layout (4.2.0 composed it in Chromium and Firefox and
  cached `native:verification` in WebKit). `mount()` and the React adapters
  compose it when it comes into range; a direct `typeset()` caller calls
  again. The React adapters also compose text they mounted inside a closed
  `<details>`, `hidden="until-found"` or `content-visibility: hidden` once
  it is shown, and text in a `content-visibility: auto` section on screen at
  page load, as 4.2.0 did (the first 4.3 candidate left all of it native for
  good). 0 golden cells change (the golden sets have no hidden text).
- **`TypesetRichText` plans once from the native text** and no longer
  re-plans over its own composed markup after `document.fonts.ready` when
  nothing changed (P4, P5). 4.2.0's final breaks could depend on that
  history. React golden diff: 2 of 2,160 blocks, both in WebKit at 320 px.
  In one, 4.3 now gives the same breaks as `typeset()` for the same markup,
  where 4.2.0's re-plan did not; the other is a block on which 4.2.0 differs
  from itself between runs. Chromium and Firefox: 0. (2,040 more differ only
  in the C2 and C9 attributes and in the order of the host's attributes, 71
  of them also in the position of a break before a link.)
- The legacy `renderFrozenLines()` export no longer sets the non-ARIA
  `role="text"`, which emptied a composed heading's accessible name in
  WebKit, and clears the element with `replaceChildren()` instead of
  `innerHTML`, so it runs under Trusted Types.
- Transient states with no static golden effect: while a block's width is
  changing and its composed lines no longer fit, it shows native wrapping
  (`data-ts-stale`) until 100 ms after the size holds, or, when it is more
  than a viewport height offscreen, until it comes that near (released to
  native in idle time meanwhile); while a page is
  machine-translated, owned text is released to native (`native:translated`);
  where nothing can be measured (jsdom, happy-dom, engines without the
  required APIs) text stays native (`native:environment`) where 4.2 threw.

### Fixed

- **Hidden content stays off the clipboard (C11).** A copy that touches a
  composed paragraph is serialized by the engine; 4.2 built its HTML from
  `range.cloneContents()`, which keeps what native copy leaves out, so a
  select-all or a cross-paragraph copy pasted `display:none` notes, hidden
  inputs such as CSRF tokens, `visibility:hidden` text, templates, scripts
  and styles. The clone is now walked in step with its source and those
  nodes are dropped; if the two ever disagree, only plain text is written.
  Copied hosts also lose the engine's residue, which pasted into an editor
  that keeps inline styles: the `text-wrap-style: auto !important` override
  (the author's own inline value is put back, so a pasted paragraph no
  longer turns off `text-wrap: pretty` or `balance`), `data-ts-stale`, and
  the React adapters' `data-typeset-react` attributes, which made the
  loaders skip pasted markup. Plain text from a copy inside one composed
  paragraph is its text as it renders, as the browser's copy gives it:
  4.2 pasted the source's own white space, so hard-wrapped HTML (Markdown
  output, templated pages) pasted a newline and indentation mid-sentence,
  with tabs and double spaces kept; and in Chromium and WebKit every copy
  kept no-break spaces, which the browser's copy turns into spaces.
- **Strict Content Security Policy and Trusted Types (C5).** Measurement and
  line-wrap styles are restored through the CSSOM, never by writing the
  style attribute. Under `style-src` without `'unsafe-inline'`, 4.2 left
  `white-space: nowrap` on paragraphs and links in Chromium and WebKit,
  erased the author's CSSOM styles in Firefox (a 300 px width became the
  container width), and logged a CSP error on every pass; `TypesetRichText`
  declined as `native:rich-whitespace`. 4.3 runs under `style-src 'self';
  script-src 'self'; require-trusted-types-for 'script'; trusted-types
  'none'` with no violation in three engines. Published bundles no longer
  read the bind-weight research global `__TYPESET_BIND__`.
- **Framework text updates never leave stale text (C6).** When Svelte, Vue,
  Solid, Lit or React (outside the adapters) set the `.data` of a Text node
  the engine had split, 4.2 replaced only line 1 and left the old lines 2..n
  on screen, merged them back on `restore()`, and `disconnect()` kept them.
  Solid and Lit updates were lost outright once a marker or tracking wrapper
  took their node's position, and React threw (removeChild) when it removed
  a Text node tracking had moved, unmounting the app. Now the mount observer
  removes the stale fragments within the mutation's microtask, before any
  frame, and recomposes; every cleanup drops the fragments of a node that
  was written to or removed; and Text nodes Solid or Lit address by
  position, and React's, stay in place (emptied, their text wrapped beside
  them). Nothing goes between a comment and the Text node after it, which
  keeps its text unwrapped: Lit starts each item of an array, `map()` or
  `repeat()`, and a top-level `render()`, with an empty comment and writes
  to the node after it, so those updates were lost too (4.2 lost them as
  well). Tested with a vanilla renderer, React 19, Svelte 5, Vue 3.5, Solid
  1.9 and Lit 3 (template parts, and iterables with a top-level `render()`)
  through twenty updates each in three engines.
- **Composed text follows text metrics, not only width (C7).** Fonts that
  finish loading (including CSS-requested fonts in WebKit, which fires no
  loading events and left 59 of 195 paragraphs stale under 4.2.0), the
  text-spacing overrides of WCAG 1.4.12, a browser font-size setting, CSSOM
  rule changes, and transitions or animations of font, spacing or
  line-height properties now recompose. A same-width height change makes
  the controller check rendered lines against the composition, and makes
  `TypesetText` and `TypesetRichText` compare their layout key, so a CSSOM
  rule, the font-size setting or a FontFace added by script (none of which
  mutates the DOM or fires an event) no longer leaves them double-wrapped.
- **Hidden text keeps its composition (C8).** A tab, dialog, accordion or
  stack card hidden with `display:none`, the `hidden` attribute or
  `content-visibility`, and shown again at the same width, paints its
  composed lines in the first frame instead of native lines re-broken a
  moment later, with `mount()`, `TypesetText` and `TypesetRichText`. Text an
  attribute change reveals at a new width composes before that frame paints.
  Text that is hidden while the window's width changes shows native
  wrapping from then on, so a reveal by CSS alone (a `:checked` tab, a media
  query) or by an attribute nothing observes paints no alternating long and
  short lines; any other reveal at a new width shows native wrapping from
  its second frame until it is recomposed. No reveal raises a
  ResizeObserver loop error (the React adapters composed inside the
  observer callback).
- **No double-wrapped frames during resizes or in print (C9).** A block
  whose width changes is recomposed once the size has held for 100 ms, not
  every frame (with `mount()` and the loaders, a block more than a viewport
  height offscreen once it comes that near); meanwhile, if it is narrower
  than its widest composed line, it shows native wrapping. The switch is
  written before the frame's layout. The rules live in a constructable
  stylesheet, which the engine adds back if the page's own assignment to
  `document.adoptedStyleSheets` removed it (printed text was double-wrapped
  in three engines after such an assignment), and which a shadow root
  holding composed text adopts too: a document's sheets do not reach into
  shadow trees, so text composed with `mount(shadowRoot, ...)` was marked
  stale to no effect through a resize (double-wrapped in 21 to 22 of 24
  frames, against 5 to 18 in 4.2.0, which recomposed per frame) and kept
  its tracking and spacing in print. Offscreen text left waiting is released
  to native in idle time, so assistive technology never reads it with its
  breaks hidden: Chromium drops the word space beside a hidden break and
  WebKit joins words at the engine's markers, which after a narrowing
  resize read 14 joined pairs in 9 offscreen blocks of a 48-block page.
  Print shows native wrapping and pauses composition. A width only layout
  can show (a stylesheet rule, a composed block moved into a narrower
  container) can still paint its first frame double-wrapped.
- **Ancestor transforms no longer leave text native for good.** A transform
  changes no line, so a composition made before one is now kept: a drawer
  that scales the page behind it or a card's hover scale no longer rewraps
  composed text. Text declined as `native:transformed` because a transform
  was still animating (a dialog or popover's `@starting-style` scale-in, a
  class-driven scale, a card inserted with `element.animate()`, the drawer
  closing) is composed when that transition or animation ends, with
  `mount()`, the loaders and `TypesetText`; 4.2.0 and the earlier 4.3
  candidate left it native until an unrelated trigger. An animation that
  never ends (an infinite pulse) is not waited on, so text under it stays
  native as in 4.2.0, and blocks replaced or unmounted under it are not
  kept in memory (the first round-2 candidate held every one while the
  animation ran). In WebKit, font keys
  no longer change when the engine collects an unreferenced `FontFace`
  wrapper, which made the first recheck after composition recompose every
  block on pages with `@font-face` rules. `verify-reflow-triggers` covers
  the drawer, the dialog and the scale-in in three engines (15 checks failed
  before). The golden sets have no transforms: 0 changed.
- **Machine translation no longer garbles or loses text (C10).** When the
  page is translated (the `translated-ltr`/`translated-rtl` class Google
  Translate and Chrome set, a `<font>` wrapper inside composed text, or
  Edge's `_msttexthash`), `mount()`, the loaders, `typeset()` and
  `TypesetText` remove their breaks and wrappers by moving the existing Text
  nodes, never splitting, merging, editing or removing one, and compose
  again when the translation ends. `TypesetRichText` freezes, and stays
  frozen when its container narrows during the translation (a re-render
  there would make React remove Text nodes the translator had replaced and
  unmount the whole root). 4.2.0 merged and edited the Text nodes the
  translator was filling, which lost sentences. The Text nodes a
  composition split stay split while the page is translated, so a
  translation can show a stray space before punctuation ("dijo ,", 3 of 9
  paragraphs in a live Google Translate check); no text is lost
  (SUPPORT.md). When the translation ends, they are merged and the smart
  quotes straightened before the text is composed again, wherever the
  translator left them as they were: a framework writing to its own Text
  node after "show original" no longer leaves the old text's split tails on
  screen beside the new text, and `disconnect()` returns the author's markup
  exactly instead of curled quotes and some 220 split Text nodes. A word
  space beside a removed break is moved in place, so a screen reader's
  live Chromium tree no longer reads joined words at every former break.
- **`mount()` works in same-origin iframes (C12).** Inserted paragraphs,
  text edits, resizes and fonts inside a parent-mounted iframe document are
  picked up, and copied links keep absolute URLs there (nodes from another
  realm failed `instanceof` checks).
- **`keep` works in body text (C14).** It was typed and exposed on both
  React adapters, but body composition never received it. A kept phrase
  that fits the measure is now never split, a phrase the browser splits can
  earn one extra line (not with `density: 'compact'`), and a phrase longer
  than the measure is split as few times as possible. Matching ignores case,
  NBSP and punctuation around the phrase, in titles too. Output with `keep`
  omitted is unchanged (golden diff 0).
- **The audit is accurate (C16).** `issue.target` resolves: every selector
  started `html:nth-of-type(0)` and matched nothing; targets now start from
  a unique id, from `body`, or are `:root`. Line-end reviews follow the
  compositor's own policy: a word before sentence punctuation and a letter
  designator are valid line ends, an abbreviation is not a sentence end, and
  untagged text gets no English word lists. `audit()` fails composed output
  that is no longer correct: `stale-layout` (a font, spacing or size change
  after composition left a block double-wrapped, which 4.2.0 passed) and
  `alignment-lost`. 4.2.0's own output carried the `hidden-break` and
  `isolated-space` errors (C2); 4.3.0's carries neither. A hanging indent
  (`padding-left` with a negative `text-indent`, as in a bibliography) is no
  longer reported as `overflow`: 4.2.0 failed the CI gate with a hard error
  for the first line of every such element in scope, native or excluded,
  so a correct page with a reference list could not pass. Overflow is
  still an error on any element, composed or not.
- **Installs beside any React 18.2+ or 19, and any Playwright (K3).** The
  React peer was `^19.2.3` and Playwright was a peer: npm failed with
  ERESOLVE beside React 18, React 19.0 or 19.1 and older Playwright, and
  upgraded `react` alone in apps locked to 19.0 or 19.1, which left
  `react-dom` behind ("Incompatible React versions"). `TypesetText` no longer
  schedules a layout effect during server rendering, which React 18 warned
  about. The published declarations no longer inline @types/react 19.2
  internals, so they compile against @types/react 18.3 and 19.0.
- **Nothing throws in test runners or older engines (K4).** Under jsdom and
  happy-dom (Jest, Vitest), and where `Intl.Segmenter`, `ResizeObserver` or
  `MutationObserver` is missing, `typeset()`, `planRichText()` and both
  adapters report `native:environment`, `mount()` returns an inert
  controller and `document.fonts` is optional. Importing no longer
  constructs an `Intl.Segmenter` or inflates the Unicode line-break trie
  (the vendored module initializes on first use; all 19,338 LineBreakTest
  cases give identical breaks), so a missing API cannot blank an application
  at import. The script-tag builds, including `typeset.us/auto`, do nothing
  where there is no `window`.
- **`typeset-audit` works on pages under a strict Content Security
  Policy.** The CLI injected its inspector as an inline `<script>`, which
  `script-src 'self'` (helmet's default) and Trusted Types refuse, so the
  documented CI command exited 2 with a runtime error on exactly the sites
  that follow SUPPORT.md's CSP guidance (4.2.0's CLI did the same). It now
  runs the inspector through the browser automation protocol; the page's
  policy still governs everything the engine does there, so a site whose
  own composition breaks under its policy still fails the audit. Tested
  under `style-src 'self'; script-src 'self'; require-trusted-types-for
  'script'; trusted-types 'none'` in Chromium, WebKit and Firefox.
- **`typeset-audit` passes correct pages longer than one screen.** Without
  `--apply`, the CLI waited a fixed 150 ms after load, while `mount()` and
  the loaders compose what is on screen first and the rest in later
  batches, so the documented CI command failed a correct 200-paragraph
  article with 176 to 193 paragraphs "unprocessed" in every engine (so did
  4.2.0's CLI with `go@4.2.0.js`). It now waits for the page's own
  composition: the loader's `window.TypesetReady`, or an outcome on every
  element in scope for pages that compose from their own code, for up to
  `--timeout` seconds (default 30) per width; a page whose composition makes
  no progress for 2 s is audited as it is. Each report records what it
  waited for (`waited`), and names the elements still unprocessed.
- **Clear errors (K11).** `typeset()` throws `TypeError: [typeset] typeset()
  expects an HTMLElement (received ...)` for a non-element, and `mount()` a
  `TypeError` naming what it received, instead of raw TypeErrors from inside
  the engine. An invalid `keep` value no longer throws once `keep` reaches
  body composition; like every invalid option it keeps its 4.2 behaviour.
- The React adapters keep their composition while hidden under the new
  per-document registry, instead of treating a width of 0 as a resize and
  showing native lines when revealed.

### Added

- Outcome reference and types: `OUTCOMES` lists every outcome code; the
  `Outcome`, `FeatureStatus`, `QuoteStatus`, `HangingStatus`,
  `SpacingStatus` and `TrackingStatus` types name them. `Result.outcome` and
  `Result.features` use these types while still accepting any string, so
  existing code compiles unchanged. OUTCOMES.md (in the package and at
  docs/outcomes.md) says what each of the 42 outcomes and 33 feature
  statuses means, whether it is expected, and what to do. New outcomes:
  `native:justify`, `native:live-region`, `native:translated` and
  `native:environment`; new tracking status: `native:tracking-comment`.
- React adapters (K5): a `ref` resolves to the host element (both are
  `forwardRef` components; a ref was dropped before, and `TypesetRichText`'s
  gave its class instance). `as` also accepts `div`, `li`, `blockquote`,
  `figcaption`, `dd`, `dt`, `td`, `th`, `caption`, `label`, `legend` and
  `summary`, with `cite`, `colSpan`, `rowSpan`, `headers`, `scope`, `htmlFor`
  and `value` attributes. `onResult(result)` reports each composition as a
  `Result`. `priority?: 'auto' | 'sync'`: `'sync'` composes in the commit, as
  4.2 did for every block. New types `TypesetTag`, `TypesetAdapterProps` and
  `Priority`.
- A CommonJS React entry (`dist/react.cjs`) for `require()` and Jest; `.`
  and `./react` give `import` and `require` their own types (`.d.ts` and
  `.d.cts`), so CommonJS consumers are not told the package is ESM-only;
  `./react` has a `default` condition; `./global` and `./go` ship
  `global.d.ts` and `go.d.ts` declaring `window.Typeset` and
  `window.TypesetReady`, `./auto` has the same types as `./go`, and
  `typesVersions` maps all three for `moduleResolution: node`. `react-dom`, which the React entry imports for
  `flushSync`, is an optional peer beside `react`.
- `mount('article p', options)`, the same as `mount(document, 'article p',
  options)`; a string first argument used to throw.
- Development warnings: an invalid option value, an unknown option or a
  non-string selector logs one `console.warn` each (the ESM and CommonJS
  entries unless `process.env.NODE_ENV` is `production`; always in
  `typeset.global.js`, `go.js` and `auto.js`), for example `[typeset]
  smartQuotes must be "en" or false (received true)`. Production bundles
  contain none of these checks; SUPPORT.md lists the messages.
  `TypesetRichText` with `smartQuotes="en"` but no `lang` of its own warns
  once in development builds.
- CSS hooks: the custom property `--ts-break-display` drives every generated
  break (set it to `inline` in print CSS to print a composition), and
  `data-ts-stale` marks a block temporarily showing native wrapping.
  `dist/styles.css` ships the rules; the engine also installs them as a
  constructable stylesheet.
- Audit: errors `stale-layout` and `alignment-lost`; reviews `bound-split`
  (a number and its unit, an honorific and a name, a label and its number,
  or a word and its letter designator split across lines), `split-ellipsis`,
  `line-initial-punctuation` and `regressed-vs-native` (a composed element
  with more line-end reviews than its native layout had). `schemaVersion`
  is still 1 and field shapes are unchanged.
- The automatic website loader on npm as `typeset.us/auto` (`dist/auto.js`),
  byte for byte the same file as `https://typeset.us/go@<version>.js`, so
  npm, jsDelivr and typeset.us serve one file with one integrity hash. Each
  loader logs one `console.info` when no element matches.

### Performance

Measured with `npm run bench` on an Apple M2 Pro, 4.2.0 and the 4.3.0
candidate back to back (load average 4.6 to 6.2); docs/BENCHMARKS.md has every
table.

- Composition costs less: per paragraph (200-paragraph article), median
  5.7 to 5.0 ms and p95 20.3 to 14.9 ms in Chromium; 25.8 to 21.1 ms and
  88.2 to 64.9 ms at 4x CPU; 24 to 19 ms and 100 to 67 ms in WebKit. The
  paragraph search is memoized and its segmenters are shared and created on
  first use, with byte-identical output (P6).
- `mount()` finishes sooner and blocks less: a 200-paragraph article is
  fully composed in 1.48 s (4.2.0: 1.74 s), 6.4 s at 4x (8.0 s) and 8.2 s in
  WebKit (10.1 s); total blocking time at 4x falls from 1,100 to 396 ms, and
  from 8,293 to 3,501 ms for 1,000 paragraphs. The scheduler no longer
  starves on a busy page: text near the viewport composes in the next task,
  an idle callback that fires on its timeout still gets its 8 ms budget, and
  offscreen blocks wait until they come near after a resize (P2).
- Ancestor class and style changes recompose nothing when layout is
  unchanged: 30 class toggles on an ancestor of 200 paragraphs recomposed 26
  times with 9,984 DOM mutation records in 4.2.0, and 0 times with 30
  records in 4.3.0 (P3). Each such change still rechecks a layout key for
  every block inside it (about 15 to 23 ms for 1,000 paragraphs at 4x CPU).
  A translation or fade (only `transform: translate(...)`, `translate` or
  `opacity` changed), which JavaScript animations write every frame, is not
  rechecked at all: 120 frames of an ancestor translation over 1,000
  paragraphs at 4x CPU in Chromium average 8.3 ms with none over 20 ms (the
  first 4.3 candidate: 22.8 ms, 84 of 118 over 20 ms).
- React screens (P4, P5): pushing 38 `TypesetText` blocks takes 192 ms from
  the click to its first paint at 4x CPU (INP proxy; 4.2.0: 232 ms, plain
  React: 56 ms), with one pre-paint task of 160 ms, and 64 ms at 1x (72
  ms), with every on-screen block composed in that paint. The commit alone
  falls from 157 to 21 ms at 4x (39 to 8 ms at 1x), but that is mostly
  work moved, not removed: 4.2.0 composed every block inside the commit,
  while 4.3.0 composes there only what fits a 6 ms budget and the rest of
  the on-screen blocks in the next frame, before it paints. Earlier 4.3
  candidates counted the page's one-time setup (80 to 90 ms at 4x) against
  that frame's 120 ms safety limit, so a cold first screen at 4x painted
  half its on-screen blocks natively and rewrapped them a frame later;
  their 152 ms was measured to that partial paint. 1,000 blocks commit in 19 ms (1,446 ms) with an INP proxy of 80
  ms (1,584 ms). 38
  `TypesetRichText` blocks commit in 23 ms at 4x (78 ms) with 941 DOM
  mutation records (3,893), and 1,000 in 38 ms (279 ms) with 0 ms of
  blocking time (5,658 ms). Every adapter in a document shares one registry:
  2 MutationObservers, 1 ResizeObserver and 1 IntersectionObserver however
  many blocks render (4.2.0: one of each per block), parent re-renders that
  change nothing (an inline `keep` array, fresh JSX, inline styles or
  callbacks) write nothing, and unmounting no longer restores the host React
  discards. Offscreen blocks compose only in idle periods of 20 ms or more
  (no frame pending), or one at a time after waiting 1 s, never in what is
  left of an animation frame, so a screen push drops no frames for them: 4.2
  dropped about 8 frames per slide at 4x CPU in Chrome, and the first 4.3
  candidate still composed in 41 of a 900 ms slide's short idle periods
  (Firefox 17). Engines without idle callbacks (WebKit) keep a 50 ms timer.
  Near means within a viewport height of the window or of the container
  the text scrolls in vertically (one whose content overflows it; an
  `overflow-x: hidden` wrapper or a horizontal carousel row is not one, or
  every block in it would be near): in an app shell's `overflow: auto` pane,
  text below the pane's fold counted as far until it was on screen, so
  blocks scrolled in within about 0.5 to 1 s of a load or screen push
  (while animations kept frames pending) painted native lines and were
  rewrapped 2 to 5 frames later, which 4.2 did not do; now none do, in
  three engines. `mount()` measures nearness the same way.
- React hosts under continuous change: a translation or fade written every
  frame on their container is no longer checked at all, as with `mount()`
  (16 blocks, 60 frames: about 10,000 computed-style reads to 0 in three
  engines). A host whose text metrics change again within 100 ms of a check
  composing it (a font-size or spacing transition, a text-size slider)
  shows native lines until they hold for 100 ms and is composed once (a
  font face finishing, even right after another, composes at once and
  never shows native lines), where
  the first 4.3 candidate recomposed every on-screen host in every frame: a
  60-frame text-size slider over 16 blocks at 4x CPU went from 466
  compositions and 30 or more long tasks to about 40 and 2, and a 1.2 s
  font-size transition from 3 or 4 long tasks to 1.
- Revealed hidden text: 10 compositions instead of 196 and 83 ms of blocking
  time at 4x instead of 1,075 ms. The first viewport of never-composed
  revealed text finishes later (428 ms at 4x against 249 ms), because
  on-screen reveals compose for at most 24 ms before the frame and
  offscreen revealed text waits until it is near.
- Per document the engine now adds one lifecycle hub: one MutationObserver
  (stylesheets and the translation class; other `<head>` writes, such as a
  ticking title, an injected script or a favicon badge, trigger no
  recheck), three document listeners
  (`transitionend`, `animationend`, `contentvisibilityautostatechange`) and
  one more font listener, shared by every controller and adapter.
- Download, gzip (esbuild bundles importing one entry point, tree-shaken):
  `mount` only 37.7 to 48.7 KB, `TypesetText` only 38.0 to 48.5 KB,
  `TypesetRichText` only 33.4 to 44.5 KB, `smartQuotes` only 11.7 to 1.3 KB
  (the line-break tables now tree-shake away), `go.js` 42.3 to 54.9 KB and
  `typeset.global.js` 42.1 to 54.6 KB. A bundler that does not tree-shake
  (Metro, the Expo and React Native Web default) ships all of
  `typeset.us/react`, `dist/react.js` and its shared chunk: `TypesetText`
  43.2 to 60.5 KB, a larger increase than any tree-shaken figure (an Expo
  web export of one app grew by 14.3 KB gzip with the first candidate).
  The growth is the code the fixes above need, measured per group and
  recorded in scripts/v4/budgets.json.

### Packaging, loaders and CDN

- npm metadata: a plain description, keywords (typography, line-breaking,
  text-wrap, orphans, widows, knuth-plass, hanging-punctuation, react and
  others), `repository.directory` so README links resolve on npmjs.com, and
  `bugs.url`. The `engines` field (`node >=22`) is removed: it made Yarn 1
  refuse installs of a browser library on older Node. The `typeset-audit`
  CLI needs Node 18.3 or later. `license` is `MIT AND Unicode-3.0`.
- The unpacked package is 1.82 MB (87 files), down from 2.57 MB, 73% of
  which was source maps embedding every engine source. The ESM and CommonJS
  builds stay readable and unminified and ship without maps (your bundler
  minifies them; stack traces name real functions); `typeset.global.js` and
  `go.js` keep maps without embedded sources. Each bundle ends with the
  license notices of the code it embeds (@cto.af/linebreak,
  unicode-trie-runtime, fflate and the Unicode line-break data), which
  minification had stripped.
- Bare `cdn.jsdelivr.net/npm/typeset.us` and `unpkg.com/typeset.us` URLs serve
  `dist/typeset.global.js` (the `jsdelivr` and `unpkg` fields), not the
  CommonJS build that browsers refuse to run.
- From the 4.3.0 cut, typeset.us publishes versioned `typeset@<v>.min.js` and
  `typeset@<v>.esm.js`, and `sri.json` lists only immutable paths; the
  go@4.2.0.js entry is unchanged. `go@4.js` follows 4.x, and `go.js` and the
  other unversioned aliases follow 4.x only: a 5.0 release will never move
  them. Versioned files are cached for a year, aliases and indexes for five
  minutes, all with `Access-Control-Allow-Origin: *`.
  docs/ops/vercel-firewall.md has the firewall bypass that stops bot
  challenges on these paths; it is applied in the Vercel project, not here.
- The build recipe is versioned (`scripts/build-recipe.mjs` `RECIPES`): a cut
  at an older tag uses that line's recipe, and `verify-recipe-reproduces`
  rebuilds the 4.2.0 tarball from its tag byte for byte (CI packs with npm
  11.6.0, the version that packed it).

### Release trust

- Releases are published by `.github/workflows/release.yml` from a `v*` tag,
  only after CI passed on that commit, `scripts/v4/release-check.mjs` rebuilt
  the ledger-recorded tarball from the tag byte for byte, and every suite
  passed against the committed dist; the publish job checks out that
  verified commit, not the tag by name, and stops if the tag was moved
  during the approval wait. It publishes exactly
  `public/releases/<v>/typeset.us-<v>.tgz` with npm trusted publishing and
  provenance, checks the registry's integrity and attestation, and creates a
  GitHub Release from the CHANGELOG section with the evidence attached.
  docs/RELEASING.md describes the flow; docs/OWNER-ACTIONS.md lists the
  GitHub, npm and Vercel settings only the owner can apply.
- CI and nightly run with `contents: read` only, every action is pinned to a
  commit SHA, and Dependabot watches npm and GitHub Actions.
- SECURITY.md (also in the package): supported versions, private reporting,
  response targets. The DOM XSS in the 3.x `Typeset.auto()` heading branch,
  fixed silently in 3.4.1, now has an advisory draft, a deprecation command
  for 3.0.0 to 3.4.0 and an `advisories` list that each cut copies into
  release.json and sri.json. The vulnerable files stay online unchanged.
- STABILITY.md states what a version number promises: API names,
  `auditJSON` `schemaVersion` 1, outcome codes, CLI exit codes and published
  bytes do not break in 4.x, and a minor release changes default rendering
  only to fix a verified defect, listed under "Rendering changes" with its
  golden-diff count. Install with `npm i -E`, or pin `go@<version>.js` with
  its integrity hash.

### Website (typeset.us, not the package)

- `/api/fetch-url` no longer reaches private networks: it connects only to a
  checked address, refuses loopback, private, link-local (including
  169.254.169.254), CGNAT, multicast and reserved addresses and their IPv6
  forms, follows at most five redirects and checks each, allows ports 80,
  443, 8080 and 8443 only, caps the body at 500 KB after decompression, and
  rate-limits each client to 12 requests a minute.
- `/audit` and `/dna` render fetched or pasted HTML inert (scripts, frames,
  plugins, `<base>`, refresh `<meta>`, event handlers and `javascript:` URLs
  removed; `/audit` in a shadow root, `/dna` in a sandboxed iframe). `/dna`
  no longer fails on pages with inline SVG.
- `/pairing-cards` builds its downloadable cards from DOM properties and
  text instead of markup, and takes from a shared link's query string only a
  listed font and hex colours. A crafted link could insert markup into the
  generated card with one click on "Generate Cards": under the new CSP a
  refresh `<meta>` that redirected to any site and images that pinged one,
  and without it (as on typeset.us until now) event handlers that ran.
- Every page has a nonce-based Content Security Policy (`script-src` with a
  per-request nonce and `strict-dynamic`, `object-src 'none'`, `base-uri
  'self'`, `frame-ancestors 'self'`), plus `nosniff`, `X-Frame-Options:
  SAMEORIGIN` and a referrer policy. Pages are rendered per request so each
  gets a fresh nonce. Next.js is 16.3.6; `npm audit` reports no
  vulnerabilities.
- The homepage names its baseline by engine, leads with the short words the
  browser leaves at line ends, and claims a one-word last line only in an
  engine that produces one. A "For developers" band gives the pinned script
  tag, npm and React, a "Do I need it?" table, the measured gzip size from
  release.json and links to framework recipes at /install/frameworks
  (Next.js, Vite, Astro, SvelteKit, Vue). Every install line on the site is
  generated from `public/sri.json`. /, /support and /library have their own
  titles, descriptions and unfurl images; /faq is new.

### Documentation

- The npm README is an introduction, not release notes: what Typeset does, a
  375 px before/after image against `text-wrap: pretty`, a "Do I need it?"
  table, pinned install paths, every option with its default, the common
  outcomes, what it costs, what it won't do, browser requirements,
  accessibility, baseline CSS, an FAQ, the stability promise and a glossary.
  Every link is absolute, so it works on npmjs.com. The repository README's
  install lines are generated from the published version and sri.json at
  each cut.
- SUPPORT.md describes 4.3.0 and lists known limitations: generated line
  breaks and find-in-page, Text Fragments, `innerText` and selection; print;
  machine translation; CSP and Trusted Types; no hyphenation or
  justification; right-to-left text; the browser floor; framework-owned
  text. MIGRATION.md covers 4.2 to 4.3 and links each older guide in its
  archive.
- Stale 3.x claims are gone from current docs and the site ("audit() returns
  []", 1.4 to 1.6 ms per paragraph, 20 KB, English only, cloned links). The
  Show HN kit, the essay, SKILL.md's frontmatter, the agent contract and
  llms.txt describe 4.3; the 3.5 agent pages are marked historical.
  docs/BENCHMARKS.md is generated from the 4.3.0 benchmark, with 4.2.0
  alongside.
- CONTRIBUTING.md, CODE_OF_CONDUCT.md (the Contributor Covenant 2.1),
  ROADMAP.md, a "Bad line break" issue form that asks for the URL, width,
  font, browser, version, `auditJSON` output and a screenshot, an
  integration question form, and a pull request template with the
  rendering-change checklist.

### Development

- `npm run build:dist` (also `build:candidate`) builds the engine into
  `output/candidate/` only. Releases are cut by `npm run release:cut`, the
  only step that writes `packages/typeset-v4/dist`, `public/releases/<v>/`,
  `public/go@<v>.js` or a version number.
- `public/releases/published.json` records every published artifact by hash;
  `verify:ledger` and CI fail if any changes.
- `npm test` builds the candidate and runs every suite against it; `npm run
  test:release` runs them against the committed dist.
- `npm run bench` is the V4 benchmark (`scripts/v4/bench-v4.mjs`), and
  `scripts/v4/bench-report.mjs` renders docs/BENCHMARKS.md from it, with
  `--baseline` for a comparison. Size budgets run on every change; runtime
  budgets (`verify-budgets --runtime`) nightly and at release cut.
- New suites in `npm test`, each in Chromium, WebKit and Firefox where it
  uses a browser: `verify-native-ax` (engine accessibility trees),
  `verify-golden`, `verify-alignment`, `verify-keep`, `verify-audit`,
  `verify-break-semantics`, `verify-strict-csp`, `verify-copy-privacy`,
  `verify-framework-text` (with committed Svelte, Vue, Solid and Lit
  fixture bundles in `tests/frameworks/`), `verify-live-regions`,
  `verify-smart-quotes`, `verify-iframe-mount`, `verify-recompose-storms`,
  `verify-reflow-triggers`, `verify-visibility`, `verify-print-resize`,
  `verify-scheduler`, `verify-translation`, `verify-options`, `verify-react`,
  `verify-react-node`, `verify-recipe-reproduces`, `verify-site-index`,
  `verify-docs`, `verify-release-trust` and `verify-package-contents`. Each
  behaviour suite fails on the published 4.2.0 build. CI-only and nightly
  lanes: `verify-test-runners` (Vitest, Jest, attw, publint),
  `verify-react-matrix`, `scripts/site/verify-site.mjs` and
  `verify-safe-fetch`.

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
