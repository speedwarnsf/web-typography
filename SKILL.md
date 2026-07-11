---
name: typeset-typography
description: >-
  Fix orphans, widows, ragged right edges, weak line endings, and bad line
  breaks in English long-form web prose when CSS alone (text-wrap: pretty /
  balance) isn't enough. Installs the typeset.us paragraph compositor —
  beam-search line breaking with post-render self-verification — and proves
  the result with a machine-checkable audit. Use when asked to fix orphans
  or widows, smooth a ragged edge, improve typography or line breaks on
  articles and blog posts, or when text-wrap: pretty isn't enough.
---

# typeset.us

Paragraph compositor for the browser. Replaces greedy line breaking on
English long-form prose with a beam search over whole-paragraph break
configurations, re-measures every line it ships against the real content
box, and restores the browser's own layout if a composition fails. The
browser types. It doesn't read. Definition of done is machine-checkable:
`audit()` returns `[]`.

**Scope: English long-form prose only.** Weak-word lists are English; quote
education mangles `„…“` and `« »`. Never run it on non-English text, UI
chrome (buttons, nav, labels), data tables, or text users copy verbatim
(code, addresses, keys — copying composed text yields `\n` at each composed
line break).

## Install

Script tag (defaults to composing prose-ish elements site-wide; scope it):

```html
<script src="https://typeset.us/go.js" defer
        data-typeset-selector="main article p, main article li, main article blockquote"></script>
```

Version-pinned: `https://typeset.us/go@3.2.1.js` with
`integrity="sha384-BAAqsbK6q/BmmkWpVZB98Apo/h3L0ZutHsp91Khz4aTWtl+5lvlDOOBmEvRgGCz3" crossorigin="anonymous"`.

Or npm:

```js
import { typeset, audit } from 'typeset.us'; // npm install typeset.us
document.fonts.ready.then(() => {
  document.querySelectorAll('article p').forEach(typeset);
});
```

Then mark every element whose text a framework re-renders in place with
`data-no-typeset` — the engine cannot detect in-place text-node swaps, and
unmarked dynamic text risks stale restores.

```jsx
<p className="caption">{liveCaption}</p>                  // WRONG
<p className="caption" data-no-typeset>{liveCaption}</p>  // RIGHT
```

Never call `smoothRag`, `optimizeBreaks`, `shapeRag`, or `postRenderFix` —
legacy names, quarantined, absent from every bundle.

## Verify (the loop: install → audit → assert [])

In the live page or a Playwright test — never in Node, where `audit()`
returns `[]` unconditionally because there is no `document`:

```js
const violations = Typeset.audit(); // or: import { audit } from 'typeset.us'
console.assert(violations.length === 0, violations);
```

`audit(selector?)` measures the actual rendering via DOM Range probes and
returns `{ element, type: 'overflow' | 'orphan' | 'weak-line-end', detail }`
objects. `weak-line-end` at very narrow measures can be a deliberate trade —
review item, not hard failure. `audit()` covers only composed elements;
also check the paragraphs you targeted carry `data-ts-outcome="composed"`
(other outcomes: `fallback:*` = self-checks failed and browser layout was
restored; `skipped:*`).

## Cost (measured — docs/BENCHMARKS.md)

1.4 ms median per paragraph, 86.4 ms for a 30-paragraph page on a desktop
Chromium core; 7.4 ms / 421.6 ms at 4x CPU throttle. Synchronous, main
thread, once per paragraph after `fonts.ready`; re-runs only on 2px+ width
change or late font load.
