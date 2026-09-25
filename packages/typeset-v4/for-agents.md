# Typeset 4.3.0: agent integration contract

Status: public release 4.3.0, following 4.2.0. Install the exact version,
`npm i -E typeset.us@4.3.0`, or the pinned go@4.3.0.js with its integrity
hash from https://typeset.us/sri.json, with project-owner approval, and
retain the prior dependency/deployment for rollback. Never recommend the
unpinned go.js for a production site. No telemetry, install hook, or
automatic registration is included. What a version may change: STABILITY.md
in the repository.

## Decide and scope

Start with native CSS balance/pretty. Use Typeset where a comparison shows a
problem worth fixing. Never change copy, font size, width or authored NBSPs
to manufacture a pass. Public default: unicode; body text may use one extra
line to repair a stranded sentence/clause opener. Explicit compact density
and maxLines constraints remain respected.
Languages: en, fr, de, es; neutral Latin-script preferences; no language inference.
Unsupported: automatic hyphenation; soft hyphens; mixed languages in one block;
RTL and vertical text; editable text; inline widgets; unsupported box decoration
and scale/rotation/perspective transforms. Justified text (native:justify) and
live regions (native:live-region: text in or containing aria-live, or role
status/alert/log/marquee/timer, or <output>) are declined on purpose. Supported sliced inline-code boxes
and pure 2D translation are measured in context. Inspect native reasons.

For DOM text: import mount, restore and auditJSON from 'typeset.us'; mount
a narrow prose/title selector; await controller.ready; disconnect on teardown.
For React: import TypesetText or TypesetRichText from 'typeset.us/react'
(ESM, or CommonJS through require). Supported React: 18.2 and later and every
19.x (optional peers react and react-dom, ^18.2.0 || ^19.0.0); tested versions
are in capabilities.json. A ref resolves to the host; `as` takes p, h1-h6,
span, div, li, blockquote, figcaption, dd, dt, td, th, caption, label, legend
or summary; onResult(result) reports each composition; priority="sync"
composes in the commit. Under jsdom or happy-dom both adapters, typeset()
and mount() report native:environment and never throw, so component tests
need no mocks. Give each text one owner and
never overlap controllers. mount() and the loaders keep text that Svelte,
Vue, Solid, Lit or React update in place correct (limits in SUPPORT.md), but
prefer the adapters for text React renders. Custom stateful children
remain native:react-component. Framework recipes (Next.js, Vite, Astro,
SvelteKit, Vue): https://typeset.us/install/frameworks.

Every element gets an outcome (result.outcome, data-ts-outcome). native:
means the browser's layout was kept on purpose, with the reason; it is not
an error. OUTCOMES.md in this package explains every code and what to do;
the Outcome type and OUTCOMES const list them. Explain a declined paragraph
from its outcome and result.constraint, not by guessing.

4.2 coordinates same-target mounts within one engine instance: first claim
wins, waiting controllers take over after release, and stats.overlappingTargets
reports waiting targets. This is a safeguard, not permission to overlap selectors,
compose a parent and child, or load multiple engine copies. Audit the actual
selector intersection. Do not confuse a tabular-number class with an instruction
to exclude every word in its container. Mark text roles explicitly when needed.

Ordinary inline white-space:nowrap groups are respected without excluding the
surrounding paragraph. Preformatted whitespace, overlong protected groups and
unsupported inline layout still have explicit native outcomes. Declared English
has bounded capitalized name/designator preferences, not general name recognition.

## Explicit craft options

spacing defaults to true for composed body text: the full bounded V3 finish,
with measured styled-run spaces and unchanged line membership/final lines.
Set spacing: false for an unspaced comparison, including React adapters, or
data-typeset-spacing="false" on the loader. Read features.spacing or
data-ts-spacing. A rejected finish retains the unspaced composition; it is not
a claim that all paragraphs were adjusted. Native-retained paragraphs stay native.

tracking defaults to true after the word-space finish, within +/-0.01em of
each eligible run's authored tracking. Chosen breaks and the final line stay
fixed. Set tracking: false (or data-typeset-tracking="false") to disable only
tracking; spacing: false disables both. Inspect features.tracking / data-ts-tracking.
Code, joining scripts, unresolved relative spacing and excessive run counts
retain untracked rendering. Verification failure rolls back tracking only.

Mount once, not on a timer or repeatedly across the whole document. The controller
discovers changed subtrees, composes visible text first, and yields between
batches while recomposing actual source, font, metric and width changes. Ancestor
class/style changes recheck computed values and compose only if they changed.
Hidden text keeps its composition; a resizing block shows native wrapping
(data-ts-stale) until its size settles; print wraps natively (the
--ts-break-display custom property; set it to inline to print a composition);
a translated page gets native:translated. mount() also accepts a selector
alone, mount('article p', options), and works in same-origin iframes.
Development builds warn once per invalid option value or unknown option;
wrong targets throw a TypeError that says what was received. Its 8ms batch target does not cap an individual
composition, DOM discovery, or browser layout.

contour defaults to 'finished': candidate ranking predicts the same bounded
spacing that will be rendered. 'natural' keeps the prior ranking for comparison.
result.search exposes actual candidate counts, eligible choices, costs and score.
Never present a retained native paragraph or a one-candidate search as a
200-way comparison. Historical designer votes are not approval of new choices.

smartQuotes: 'en' enables length-preserving English quotes ONLY. It is an
intentional source transformation and changes copied text to displayed quotes.
Rich React also requires lang="en" on its adapter for deterministic SSR.
opticalHanging: true aligns eligible leading glyphs; native reasons explain
clipped/unsupported cases. Neither option is on by default. styleProseLists(root)
plus typeset.us/styles.css styles only eligible unordered prose lists. Restore
its handle on teardown. Do not style navigation or ordered lists.

## Verify in a real browser

1. Capture source text, author element identity and focused link before applying.
2. Wait for fonts and controller readiness.
3. Require exact source unless quotes were explicitly enabled; then compare to
   smartQuotes(original). Check one copy of each link and its activation.
4. Run auditJSON(selector) at mobile and desktop widths. Empty scope fails.
5. Require no hard errors or unprocessed targets; inspect outcomes, reviews and
   feature outcomes separately. A pass does not mean aesthetic perfection,
   all targets composed, or source preservation without a before capture.
6. Exercise selection, copying, resize, font replacement, updates and teardown.

auditJSON schema 1 pass means:
nonempty scope, no hard errors, no unprocessed targets. It does not mean aesthetic approval.
Each issue.target is a selector document.querySelector resolves to the flagged
element: a unique id, or a path from body. Errors: overflow, nested-output,
alignment-lost, hidden-break, isolated-space, stale-output, stale-layout. Reviews: orphan,
first-singleton, weak-line-end, stranded-opener, bound-split (number/unit,
honorific/name, label/number, word/letter designator), split-ellipsis,
line-initial-punctuation, regressed-vs-native (more line-end reviews than the
native layout had), composition-constraint, unmeasurable, unprocessed. Line-end
reviews follow the compositor's policy: English lists for declared English,
the language profile for fr/de/es, none for untagged text; a word before
sentence punctuation, an abbreviation and a letter designator are judged as
the compositor judges them.
Unavoidable geometry, unsupported content, and a solver search limit differ.
Read measured constraint.kind before explaining why composition was declined.

## Packaged audit command

Install the optional runner with npm install -D playwright, then
npx playwright install chromium (Playwright is not a peer of this package,
so any version installs cleanly). The CLI needs Node 18.3 or later. Run
typeset-audit --help, or:

    typeset-audit --url http://localhost:3000 --selector 'article p'

Read-only by default. --apply composes only an isolated preview, never the
deployed site. Exit 0 is the documented safety/coverage gate; 1 fails it;
2 is invocation/runtime failure. stdout is JSON; errors go to stderr. Reports
stay local. Do not upload page text, project identity or results without consent.

## Upgrade and rollback

Read MIGRATION.md and SUPPORT.md inside this package. Keep the prior version pinned until
the pilot passes. New globals use window.Typeset; go.js targets [data-typeset]
explicitly. Restore or disconnect DOM ownership, unmount React, restore list
styling, and revert the recorded dependency/deployment to roll back.
The website go@4.3.0.js, and the identical typeset.us/auto (dist/auto.js)
in this package, keep the broad automatic prose/headings scope and craft
defaults of the previous website loader. Override its selector with
data-typeset-selector; exclude content with data-no-typeset. npm /go remains
explicitly scoped to [data-typeset]. Both log one console.info when nothing
matches. All old website pins remain immutable.

Outstanding external acceptance: physical iOS/Android; spoken VoiceOver/NVDA;
non-macOS and native-application rich clipboard; representative-device performance.
Owner approved release with these limits. Check the repository CI for exact
commit results; do not infer device certification from a green workflow.
