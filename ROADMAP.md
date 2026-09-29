# Roadmap

What is planned after 4.4, and why each item waits. Order is intent, not a
promise; STABILITY.md governs what a minor release may change.

## 4.3: trust

Accessible, stable, installable. Output that reads correctly in the
accessibility trees of Chromium, WebKit and Firefox; correct composition
through hidden panels, late fonts, printing and framework updates; React 18
and 19, test runners and strict CSP; pinned-first installs, a
provenance-publishing release workflow (in use once npm trusted publishing
is configured; 4.3.0 itself is published by the maintainer account) and
documented outcomes. No new typographic features.

## 4.4: adoption

What shipped, from what sites installing 4.3 ran into. A paragraph with a
run of more than 500 code points between break opportunities keeps the
browser's layout (`native:run-budget`), so user-generated text can no longer
freeze a WebKit tab. `lang` spellings such as `en_US` and `english` are read
as the language they name, up to three Greek or Cyrillic letters in Latin
text compose, and quotes are curled only where they can be quotation marks;
the script tag curls them only in text declared English. The loaders wait
for a server-rendered page to hydrate before composing it, and
`whenSettled()` tells visual tests when composition is done. New options
`copy`, `headings` and `coverage`: `coverage: 'extended'` opts in to other
Latin-script languages, foreign Latin-script phrases and more inline markup
(`sup`, `sub`, `time`, `dfn`, `kbd`, `ins`, visually hidden text), and the
default, `'core'`, composes what 4.3.1 composed. Marker styles moved to the
engine's stylesheet (a composed paragraph's markup from 20 to 28 KB to about
2.4 KB), and the audit gained the `clipped`, `untagged` and `uncomposed`
review items.

## Later in 4.x

- **Newline-free rendering, opt-in.** Per-line spans instead of generated
  `<br>`, so find-in-page, Text Fragment links, `innerText` and selection
  see no extra line breaks. It overflows if a container narrows before
  Typeset recomposes, so it waits for 4.3's reflow triggers to prove
  themselves in the field.
- **Fewer finish elements.** 4.4 moved the spacing and tracking markers'
  shared styles to a stylesheet; the element count is unchanged, which
  still breaks word-by-word translation and costs DOM size.
- **Resumable composition.** Split one paragraph's work across frames with
  `scheduler.yield`, so a long paragraph on a slow phone is no longer one
  long task.
- **Hyphenation, then justified text.** Take hyphenation points from the
  browser's own `hyphens: auto`, then offer a justified mode. Until then,
  justified text keeps the browser's layout.
- **The rest of the markup coverage.** `q`, `br`, `wbr`, emoji images,
  `text-indent` and `::first-letter` still decline whole paragraphs, under
  both `coverage` values.
- **Break weights retuned** against an adversarial corpus, with the rule
  that no paragraph may gain an audit issue the browser's layout lacks.
- **`<typeset-text>`**, a custom element, with thin Vue, Svelte and Astro
  wrappers, then a WordPress plugin.
- **Smaller imports.** Leaf entry points (`typeset.us/smart-quotes`,
  `typeset.us/lists`) and line-break tables loaded after first paint.
- **An optional pre-paint bootstrap** for above-the-fold text on
  server-rendered pages.
- **Nearness that follows vertical scrolling only.** 4.3 and 4.4 measure a
  text's nearness against the nearest ancestor that scrolls on either
  axis, so offscreen text under an `overflow-x: hidden` app root or in a
  horizontal carousel counts as near and composes during screen
  transitions (frames only; the text is correct), and prose more than a
  pane height below an app shell's fold can paint native lines for one
  frame on a jump soon after load. Four 4.3 attempts each broke text a
  real pane hides (virtualized rows, panes that grow), so the fix must pass
  verify-scheduler's virtualized-list, growing-pane and app-shell checks as
  well as the horizontal-wrapper ones.
- **The library in its own workspace**, separate from the website.

## 5.0

- Revisit the spacing and tracking defaults on ragged text, the website
  loader's default smart quotes and hanging punctuation, and whether
  `coverage: 'extended'` becomes the default. These change what existing
  pages render, so they wait for a major version.
- Move the retained v3 exports (`composeParagraph`, `tokenize`,
  `renderFrozenLines` and others) to `typeset.us/legacy`, and unify the
  outcome vocabulary into a strict union.

Suggestions: open an issue with a page that shows the problem.
