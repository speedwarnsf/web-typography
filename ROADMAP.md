# Roadmap

What is planned after 4.3, and why each item waits. Order is intent, not a
promise; STABILITY.md governs what a minor release may change.

## 4.3: trust

Accessible, stable, installable. Output that reads correctly in the
accessibility trees of Chromium, WebKit and Firefox; correct composition
through hidden panels, late fonts, printing and framework updates; React 18
and 19, test runners and strict CSP; pinned-first installs, a
provenance-publishing release workflow (in use once npm trusted publishing
is configured; 4.3.0 itself is published by the maintainer account) and
documented outcomes. No new typographic features.

## 4.4

- **Newline-free rendering, opt-in.** Per-line spans instead of generated
  `<br>`, so find-in-page, Text Fragment links, `innerText` and selection
  see no extra line breaks. It overflows if a container narrows before
  Typeset recomposes, so it waits for 4.3's reflow triggers to prove
  themselves in the field.
- **A lighter spacing and tracking finish.** Fewer elements and no large
  inline styles, which fixes word-by-word translation and the DOM size
  cost of the current finish.
- **Resumable composition.** Split one paragraph's work across frames with
  `scheduler.yield`, so a long paragraph on a slow phone is no longer one
  long task.
- **Hyphenation, then justified text.** Take hyphenation points from the
  browser's own `hyphens: auto`, then offer a justified mode. Until then,
  justified text keeps the browser's layout.
- **Wider markup and language coverage.** `sup`, `q`, `time`, `kbd`, `br`,
  `wbr`, emoji images, `text-indent`, `::first-letter`, foreign phrases and
  more declared Latin-script languages, which today decline whole
  paragraphs.
- **Break weights retuned** against an adversarial corpus, with the rule
  that no paragraph may gain an audit issue the browser's layout lacks.
- **`<typeset-text>`**, a custom element, with thin Vue, Svelte and Astro
  wrappers, then a WordPress plugin.
- **Smaller imports.** Leaf entry points (`typeset.us/smart-quotes`,
  `typeset.us/lists`) and line-break tables loaded after first paint.
- **An optional pre-paint bootstrap** for above-the-fold text on
  server-rendered pages.
- **Nearness that follows vertical scrolling only.** 4.3 measures a
  text's nearness against the nearest ancestor that scrolls on either
  axis, so offscreen text under an `overflow-x: hidden` app root or in a
  horizontal carousel counts as near and composes during screen
  transitions (frames only; the text is correct), and prose more than a
  pane height below an app shell's fold can paint native lines for one
  frame on a jump soon after load. Four 4.3 attempts each broke text a
  real pane hides (virtualized rows, panes that grow), so the fix waits
  for 4.4 and must pass verify-scheduler's virtualized-list, growing-pane
  and app-shell checks as well as the horizontal-wrapper ones.
- **The library in its own workspace**, separate from the website.

## 5.0

- Revisit the spacing and tracking defaults on ragged text, and the website
  loader's default smart quotes and hanging punctuation. These change every
  page's rendering, so they wait for a major version.
- Move the retained v3 exports (`composeParagraph`, `tokenize`,
  `renderFrozenLines` and others) to `typeset.us/legacy`, and unify the
  outcome vocabulary into a strict union.

Suggestions: open a Discussion, or an issue with a page that shows the
problem.
