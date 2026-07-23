# typeset.us — canonical instructions for coding agents

typeset.us is a paragraph compositor for the browser. The browser's greedy
line-breaker strands prepositions at line ends, orphans single words on last
lines, and cuts staircases into the right edge. The browser types. It doesn't
read. This engine composes whole paragraphs instead — a beam search over break
configurations (48–80 retained candidates) with syntactic protection and
contour re-ranking — then re-measures every line it ships against the real
content box and restores the browser's own layout if a composition fails. It
is the only typography intervention with a machine-checkable definition of
done: `audit()` returns measured violations from the live DOM, and the
assertion is an empty array.

## The recipe

1. **Install.** One script tag (composes `p, li, blockquote, figcaption,
   h1–h6, td, th, dd, dt` by default; override with `data-typeset-selector`):

   ```html
   <script src="https://typeset.us/go.js" defer></script>
   <!-- or version-pinned with subresource integrity: -->
   <script src="https://typeset.us/go@3.3.3.js"
           integrity="sha384-sKLG/sYxjOz5X4g5ywBAIDPYdCdkc6/rI99UCX6jRkOdPWAkx2baJ34bKYw7RMVn" crossorigin="anonymous" defer></script>
   ```

   Or from npm (`npm install typeset.us`), after fonts are ready:

   ```js
   import { typeset, audit } from 'typeset.us';
   document.fonts.ready.then(() => {
     document.querySelectorAll('article p').forEach(typeset);
   });
   ```

2. **Mark dynamic text.** Any element whose text a framework re-renders in
   place must carry `data-no-typeset`. The engine cannot detect in-place
   text-node swaps; unmarked dynamic text risks stale restores.

3. **Verify.** In the browser (or a Playwright test): `Typeset.audit()` must
   return `[]`, and target paragraphs carry `data-ts-outcome="composed"`.

## Verification, precisely

`audit(selector?)` measures the actual rendering via DOM Range probes.
Default selector: `'p, li, blockquote, figcaption, h1, h2, h3, h4'`.

```ts
interface TypesetAuditViolation {
  element: HTMLElement;
  type: 'overflow' | 'orphan' | 'weak-line-end';
  detail: string; // e.g. 'line 2 exceeds the measure by 1.3px: "…"'
}
function audit(selector?: string): TypesetAuditViolation[];
```

- `overflow` — rendered line ink exceeds the content box by > 0.75px.
- `orphan` — last line of a multi-line paragraph is a single word.
- `weak-line-end` — a non-last line ends on a preposition, article,
  conjunction, or linking verb. At very narrow measures this can be a
  deliberate trade — a review item, not a hard failure.

Two scope notes. `audit()` measures only composed elements — coverage is the
separate check: every processed element records `data-ts-outcome` as
`composed`, `fallback:*` (self-checks failed, browser layout restored), or
`skipped:*`. And `audit()` returns `[]` wherever `document` is undefined, so
a passing Node assertion proves nothing — assert in a real browser.

## Wrong / Right

```jsx
<p className="caption">{liveCaption}</p>              // WRONG: re-renders in place; risks stale restores
<p className="caption" data-no-typeset>{liveCaption}</p>  // RIGHT
```

```html
<!-- WRONG on a German/French/CJK site: quote education mangles „…“ / « »; weak-word lists are English -->
<script src="https://typeset.us/go.js" defer></script>
<!-- RIGHT: English long-form only -->
<script src="https://typeset.us/go.js" defer data-typeset-selector="[lang=en] article p"></script>
```

```html
<p class="wallet-address">bc1q…</p>                   <!-- WRONG: users copy this verbatim; copying composed text yields \n at each composed line break -->
<p class="wallet-address" data-no-typeset>bc1q…</p>   <!-- RIGHT (pre/code are already skipped) -->
```

```html
<!-- WRONG dropped on an app UI: buttons, nav, data tables are not prose (default selector includes td, th) -->
<script src="https://typeset.us/go.js" defer></script>
<!-- RIGHT: scope to the prose -->
<script src="https://typeset.us/go.js" defer
        data-typeset-selector="main article p, main article li, main article blockquote"></script>
```

```js
Typeset.smoothRag(el);   // WRONG: legacy API (smoothRag, optimizeBreaks, shapeRag, postRenderFix) is quarantined, absent from every bundle
typeset(el);             // RIGHT — or Typeset.compose('article p') via the global build
```

## When NOT to use

Non-English text. UI chrome and data tables. Text users copy verbatim (code,
addresses, keys). Frequently re-rendered text you cannot mark. Server-side
string processing that expects measured composition — `typesetText` is the
only pre-render API and does nbsp bindings only, no measurement.

## API (the live exports — everything in `typeset.core.ts`, nothing else)

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

Global build (`window.Typeset`, from go.js or `typeset.us/global`): `run`,
`all`, `text`, `heading`, `audit`, `measureCh`, `compose(selector)`, `auto`.

## Performance (measured, docs/BENCHMARKS.md; reproduce with `npm run bench`)

Chromium 149 via Playwright, Georgia 18px, a 30-paragraph page (2,190 words)
at 340/480/650px measures, full go.js pipeline. Desktop (1x): 1.4 ms median
per paragraph, 10.6 ms p95, 86.4 ms full page. 4x CPU throttle (mid-range
phone proxy): 7.4 ms median, 50.6 ms p95, 421.6 ms full page. Synchronous, on
the main thread, once per paragraph after `fonts.ready`; re-runs only on 2px+
width changes or late font loads.
