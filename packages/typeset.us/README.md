# typeset.us

The browser sets text with a greedy line-breaker: fill the line until the next
word won't fit, then break. At narrow measures that strands prepositions at
line ends, orphans single words on last lines, and cuts staircases into the
right edge. This package is the engine behind [typeset.us](https://typeset.us):
a paragraph compositor that scores whole paragraphs — meaning first, shape
second — and verifies its own output against the actual rendering.

## What it does

- **Beam-search composition** — scores whole-paragraph break configurations
  (48–80 retained candidates) instead of one line at a time. No optimality
  claim; a verified-adequacy one (see below).
- **Syntactic protection** — prepositions, articles, conjunctions, and
  linking verbs are not left stranded at line ends; sentence starts are not
  dangled; orphans are non-negotiable.
- **Contour re-ranking** — among near-optimal candidates, prefers the
  calmest rag: lowest spread, smallest neighbor steps, no two-register drift.
- **Hanging punctuation** and quote/dash education (the author's dash
  spacing style is preserved).
- **Self-verification** — every composition is re-measured line by line
  after rendering. Overflowing or starved output is discarded and the
  browser's own layout restored; every element records its outcome in
  `data-ts-outcome`. `audit()` returns measured violations (overflow,
  orphan, weak line-end) from the live DOM — suitable for CI.

Measured cost: ~1.4 ms per paragraph in Chromium at desktop speed, ~6.6 ms
at a 4x-throttled mid-range-phone proxy (see `docs/BENCHMARKS.md` in the
repository).

## Install

```bash
npm install typeset.us
```

This installs the engine alone — 152 KB, no dependencies. The grading CLI
(`npx typeset.us audit`) additionally needs `npm i -D playwright-core`,
which drives your installed Chrome or Edge and downloads no browsers.

```js
import { typeset, audit } from 'typeset.us';

document.fonts.ready.then(() => {
  document.querySelectorAll('article p').forEach(typeset);
  console.assert(audit().length === 0);
});
```

Or the zero-config drop-in, served from the site the engine dogfoods on:

```html
<script src="https://typeset.us/go.js" defer></script>
```

Or the global build from this package (`window.Typeset`):

```html
<script src="node_modules/typeset.us/dist/typeset.global.js" defer></script>
<script>Typeset.compose('article p')</script>
```

## Rules of engagement

- Give the engine static text. Elements whose text a framework re-renders
  in place should opt out with `data-no-typeset` (the engine cannot detect
  in-place text-node swaps).
- English-only heuristics for now: the weak-word lists and quote education
  assume English. The engine skips what it cannot measure, but if your page
  is mostly another language, don't run it there yet.
- Copying composed text yields a newline at each composed line break.

## API

| Export | What it does |
|---|---|
| `typeset(el)` | Full pipeline on one element, self-checks included |
| `typesetAll(selector)` | `typeset` over a selector |
| `typesetText(text, opts?)` / `typesetHeading(text)` | String-level nbsp bindings (pre-render, no measurement) |
| `audit(selector?)` | Measured violations from the live DOM |
| `linesOverflow(el)` / `linesStarved(el)` | The self-checks, callable directly |
| `tokenize`, `composeParagraph`, `shapeExactLines`, `finalValidate`, `renderFrozenLines` | The pipeline stages, for advanced use |

MIT © Dustin York
