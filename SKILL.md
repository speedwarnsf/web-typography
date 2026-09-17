---
name: typeset-audit
description: >-
  Audit and fix line-break quality in English long-form web prose: orphans,
  widows, weak line endings, and ragged right edges. Unlike typography advice,
  this is a machine-checkable gate — audit() returns [] or it names the exact
  failing lines, and a composition that fails its own self-check restores the
  browser's layout. Installs the typeset.us paragraph compositor (beam-search
  line breaking with post-render self-verification) to fix what the audit finds.
  Use when asked to check or fix orphans, widows, or bad line breaks; when
  text-wrap: pretty or balance isn't enough; or for symptoms like "one word
  alone on the last line", "the right edge looks ragged", or "line breaks look
  wrong after deploy".
---

# typeset.us

> Historical V3 integration guidance below. For the current 4.0.0 release,
> use https://typeset.us/for-agents.md and its linked support/migration contract.
> The old audit-array, clipboard, API and performance statements below are
> not the V4 contract. Do not apply this archived procedure to V4.

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

Version-pinned: `https://typeset.us/go@3.5.0.js` with
`integrity="sha384-RZw93n+DsSryf1jIeTMdbA4sD4b5AQ9ritormzuuoSxTmYNk7gF5vFjHJ9lE7e/l" crossorigin="anonymous"`.

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
restored; `skipped:*`, including `skipped:non-english` — since 3.5.0 the
engine declines non-English content untouched rather than guess;
`unmeasurable` = zero-width or hidden when the engine ran).

Two attributes, two meanings — do not confuse them:

| attribute | means |
|---|---|
| `data-typeset-done` | the engine has FINISHED with this element, whatever it decided |
| `data-ts-outcome` | what it decided |

Wait on `data-typeset-done`, then read `data-ts-outcome`. Before 3.4.0 the
done flag was set only on success, so a paragraph that fell back stayed
"pending" forever and readiness polls hung — if you wrote a wait loop against
an older version, upgrade.

Firefox composes non-deterministically on roughly 1 load in 30 (all versions;
Chromium and WebKit do not). Scope rag gates per engine — see
[CHANGELOG](CHANGELOG.md).

## What it does to your text

Beyond line breaking, the compositor binds two-word place names against a
break — `San Francisco` stays whole where the rag allows. It is a cost, not a
weld: where the pair cannot fit, the break still happens. The rule is
deliberately narrow (`san`/`santa` open, exact bigrams for everything else)
because an open particle list measured 9.9% precision over 3.71M words of
English and bound things like "Mount Mode" and "Server Port".

Method, weights, and the evidence against them: docs/BINDING.md.

Since 3.5.0, composition runs TIGHTER at wide measures (48ch and up): fill
targets rise and auxiliary line-enders ("…the tell is") price out
entirely, so wide columns no longer trade an extra line against the
browser or stop visibly short of the measure.

## Cost (measured — docs/BENCHMARKS.md)

1.6 ms median per paragraph, 92.9 ms for a 30-paragraph page on a desktop
Chromium core; 7.1 ms / 418.5 ms at 4x CPU throttle. Synchronous, main
thread, once per paragraph after `fonts.ready`; re-runs only on 2px+ width
change or late font load.
