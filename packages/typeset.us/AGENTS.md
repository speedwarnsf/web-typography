# AGENTS.md — typeset.us

You have installed `typeset.us@3.4.2` (MIT). It is a paragraph compositor
for the browser: a beam search over whole-paragraph break configurations
(48–80 retained candidates) with syntactic protection for weak words, which
re-measures every line it ships against the real content box and restores
the browser's own layout if a composition fails. The browser types. It
doesn't read. The definition of done is machine-checkable: `audit()`
returns measured violations from the live DOM; assert it returns `[]`.

## Use it

```js
import { typeset, audit } from 'typeset.us';

document.fonts.ready.then(() => {
  document.querySelectorAll('article p').forEach(typeset);
});
```

Rules, in order of how often agents get them wrong:

1. **Run after `document.fonts.ready`.** Composition measures the rendered
   font; measuring the fallback font produces wrong line breaks.
2. **Mark dynamic text with `data-no-typeset`.** The engine cannot detect
   in-place text-node swaps (a React caption that re-renders in place, a
   live counter). Unmarked dynamic text risks stale restores.
3. **English long-form prose only.** The weak-word lists are English; quote
   education mangles `„…“` and `« »`. Scope your selector to English
   article/main paragraphs — never UI chrome, nav, buttons, or data tables.
4. **Exclude text users copy verbatim** (code, addresses, keys): copying
   composed text yields a `\n` at each composed line break.
5. **Never call the legacy API** — `smoothRag`, `optimizeBreaks`,
   `shapeRag`, `postRenderFix` are quarantined and absent from every build
   in `dist/`. Importing them fails; `typeset(el)` replaces all of them.

Builds: ESM `dist/index.js` (the `import` above), CJS `dist/index.cjs`,
types `dist/typeset.core.d.ts`, and a global build:

```html
<script src="node_modules/typeset.us/dist/typeset.global.js" defer></script>
<script>Typeset.compose('article p')</script>
```

`Typeset.compose(selector)` waits for `fonts.ready` itself, skips
`data-no-typeset`/`pre`/`code`/centered/short (<30 chars) elements, and
recomposes on 2px+ width changes and late font loads.

## Verify

```js
import { audit } from 'typeset.us';
console.assert(audit().length === 0);
```

```ts
interface TypesetAuditViolation {
  element: HTMLElement;
  type: 'overflow' | 'orphan' | 'weak-line-end';
  detail: string; // e.g. 'line 2 exceeds the measure by 1.3px: "…"'
}
function audit(selector?: string): TypesetAuditViolation[];
// default selector: 'p, li, blockquote, figcaption, h1, h2, h3, h4'
```

- `overflow` — rendered line ink exceeds the content box by > 0.75px.
- `orphan` — last line of a multi-line paragraph is a single word.
- `weak-line-end` — a non-last line ends on a preposition, article,
  conjunction, or linking verb. At very narrow measures this can be a
  deliberate trade — a review item, not a hard failure.

Three facts that make this verification honest:

- `audit()` returns `[]` in any environment without a `document`. A passing
  assertion in a Node unit test proves nothing — assert in a real browser
  (Playwright/Puppeteer; the engine's own CI asserts it in Chromium and
  WebKit).
- `audit()` measures only composed output. Coverage is a separate check:
  every processed element records `data-ts-outcome` — `composed`,
  `fallback:*` (self-checks failed, browser layout restored), or
  `skipped:*`. Done = empty audit + `data-ts-outcome="composed"` on the
  paragraphs you targeted.
- The self-checks run without you: `finalValidate` re-measures every frozen
  line before render; `linesOverflow`/`linesStarved` run after render and
  trigger the plain-text restore. `audit()` is your independent probe of
  the same DOM.

## Exports

| Export | What it does |
|---|---|
| `typeset(el)` | Full pipeline on one element, self-checks included |
| `typesetAll(selector)` | `typeset` over a selector |
| `typesetText(text, opts?)` / `typesetHeading(text)` | String-level nbsp bindings (pre-render, no measurement) |
| `audit(selector?)` | Measured violations from the live DOM |
| `linesOverflow(el)` / `linesStarved(el)` | The post-render self-checks, callable directly |
| `measureCh(el)` | Element width in ch units |
| `safeWrite(fn)` / `shouldIgnoreMutation()` | Wrap your own DOM writes so the engine's observer ignores them |
| `tokenize`, `composeParagraph`, `shapeExactLines`, `finalValidate`, `renderFrozenLines` | Pipeline stages, advanced use |

## What it does to your text

Beyond line breaking, the compositor binds two-word place names against a
break — `San Francisco` stays whole where the rag allows. It is a cost, not a
weld: where the pair cannot fit, the break still happens. The rule is
deliberately narrow (`san`/`santa` open, exact bigrams for everything else)
because an open particle list measured 9.9% precision over 3.71M words of
English and bound things like "Mount Mode" and "Server Port".

Method, weights, and the evidence against them: docs/BINDING.md.

## Cost (measured; see docs/BENCHMARKS.md in the repository)

Chromium 149, Georgia 18px, 30 paragraphs / 2,190 words at 340/480/650px:
1.4 ms median per paragraph and 86.4 ms full page on a desktop core; 7.4 ms
median and 421.6 ms full page at 4x CPU throttle. Synchronous, on the main
thread, once per paragraph after `fonts.ready`.
