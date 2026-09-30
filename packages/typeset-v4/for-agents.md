# Typeset 4.4.0: agent integration contract

Status: public release 4.4.0, a minor release of 4.3 that includes 4.3.2's
fix. Install the exact version,
`npm i -E typeset.us@4.4.0`, or the pinned go@4.4.0.js with its integrity
hash from https://typeset.us/sri.json, with project-owner approval, and
retain the prior dependency/deployment for rollback. Never recommend the
unpinned go.js for a production site; typeset.us hosting has no uptime
guarantee, so for production prefer the npm package (self-hosted
typeset.us/auto) or the same pinned file from jsDelivr. No telemetry,
install hook, or automatic registration is included. What a version may
change: STABILITY.md in the repository. What changed from 4.3: MIGRATION.md.

## Decide and scope

Start with native CSS balance/pretty. Use Typeset where a comparison shows a
problem worth fixing. Never change copy, font size, width or authored NBSPs
to manufacture a pass. Public default: unicode; body text may use one extra
line to repair a stranded sentence/clause opener. Explicit compact density
and maxLines constraints remain respected.
Languages depend on the coverage option. Line-end preferences exist for
en, fr, de and es only; untagged text gets neutral preferences; no language
is inferred. With coverage: 'core' (the default), only en, fr, de, es and
untagged text compose, and any descendant in a different language leaves
the block native:mixed-language, as in 4.3.1. With coverage: 'extended'
(opt-in: data-typeset-coverage="extended", the coverage prop), text
declared in any other Latin-script language (pt, it, nl, pl, sv, tr, vi,
...) composes with neutral preferences, and a descendant in another
Latin-script language (<span lang="es"> in English text) is set with the
block's preferences.
Under both: lang spellings such as en_US, en_US.UTF-8 and english read as
the language they name; up to three Greek or Cyrillic letters in a row in
Latin text (5 μg, α-synuclein) compose; languages in other scripts (ar, he,
ja, zh, ko, th, hi, el, Cyrillic sr) and a block with a phrase in one stay
native (native:language, native:mixed-language, native:script).
coverage: 'extended' also composes time, dfn, kbd, ins, sup, sub
(vertical-align super/sub, measured in place), visually hidden sr-only text
and zero-width aria-hidden elements; 'core', the default, leaves blocks with
them native.
Unsupported: automatic hyphenation; soft hyphens;
RTL and vertical text; editable text; inline widgets; br, img, svg, q, bdi,
visible aria-hidden icons and ::after link icons inside a block; unsupported
box decoration and scale/rotation/perspective transforms. Justified text
(native:justify) and live regions (native:live-region: text in or containing
aria-live, or role status/alert/log/marquee/timer, or <output>) are declined
on purpose. A block with more than 500 code points between two line-break
opportunities is declined as native:run-budget before anything is measured
(a WebKit freeze guard, no opt-out); for user-generated text also set
overflow-wrap: break-word or exclude it. Supported sliced inline-code boxes
and pure 2D translation are measured in context. Inspect native reasons.

Before installing on an existing site, preview it without changing the
site: npx typeset-audit --url <page> --selector 'article p' --apply (see the
audit command below). For DOM text: import mount, restore and auditJSON from
'typeset.us'; mount a narrow prose/title selector; await controller.ready;
disconnect on teardown.
For React: import TypesetText or TypesetRichText from 'typeset.us/react'
(ESM, or CommonJS through require). Supported React: 18.2 and later and every
19.x (optional peers react and react-dom, ^18.2.0 || ^19.0.0); tested versions
are in capabilities.json. A ref resolves to the host; `as` takes p, h1-h6,
span, div, li, blockquote, figcaption, dd, dt, td, th, caption, label, legend
or summary; onResult(result) reports each composition; priority="sync"
composes in the commit (use it for hero text that must never paint native
lines). Under an overflow-x: hidden app root or in a horizontal carousel,
offscreen blocks count as near and compose in frames during screen
transitions; on an app root, overflow-x: clip clips the same way without
making a scroll container. Under jsdom or happy-dom both adapters, typeset()
and mount() report native:environment and never throw, so component tests
need no mocks. Give each text one owner and
never overlap controllers. mount() and the loaders keep text that Svelte,
Vue, Solid, Lit or React update in place correct (limits in SUPPORT.md), but
prefer the adapters for text React renders. Custom stateful children
remain native:react-component. Framework recipes (Next.js, Vite, Astro,
SvelteKit, Vue): https://typeset.us/install/frameworks.

Every element composed or declined gets an outcome (result.outcome,
data-ts-outcome); excluded content and live regions get no attribute, and
auditJSON counts them as excluded and native:live-region. native: means
the browser's layout was kept on purpose, with the reason; it is not an
error. OUTCOMES.md in this package explains every code and what to do;
the Outcome type and OUTCOMES const list them. Explain a declined paragraph
from its outcome and result.constraint, not by guessing. There are 43
outcome codes; native:run-budget is new in 4.4, so an exhaustive switch over
Outcome needs a case for it.

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
data-typeset-spacing="false" on the loader. spacing: false is also the
low-element mode: no spacing markers or tracking wrappers, so a composed
paragraph gains little more than its line breaks (long pages, session-replay
recorders). Read features.spacing or
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
(data-ts-stale) until its size settles (far offscreen text, until it comes
near); print wraps natively (the
--ts-break-display custom property; set it to inline to print a composition);
a translated page gets native:translated. mount() also accepts a selector
alone, mount('article p', options), and works in same-origin iframes.
headings defaults to true; headings: false (data-typeset-headings="false")
makes mount(), typesetAll() and the loaders leave h1-h6, [role=heading] and
anything inside them untouched with no outcome written, for projects that
need an accessibility sign-off first (iOS VoiceOver may read a heading with
a generated break as two items; not yet checked by ear); typeset(el) still
composes the element given. copy defaults to true: a document copy handler
puts the source text on the clipboard without generated breaks. copy: false
(data-typeset-copy="false", copy={false}) leaves that element's copying to
the browser, which then copies a line break at every composed line end.
Development builds warn once per invalid option value or unknown option;
wrong targets throw a TypeError that says what was received. Its 8ms batch target does not cap an individual
composition, DOM discovery, or browser layout.

contour defaults to 'finished': candidate ranking predicts the same bounded
spacing that will be rendered. 'natural' keeps the prior ranking for comparison.
result.search exposes actual candidate counts, eligible choices, costs and score.
Never present a retained native paragraph or a one-candidate search as a
200-way comparison. Historical designer votes are not approval of new choices.

smartQuotes: 'en' enables length-preserving English quotes ONLY, in
declared English and untagged text; 'en-declared' only where the element or
an ancestor declares en or en-*. It is an intentional source transformation
and changes copied text to displayed quotes. A double quote with white space
or the text's edge on both sides, or with no open quotation to close
(width="100"), stays straight. Rich React also requires lang="en" on its
adapter for deterministic SSR, and 'en-declared' needs lang on either
adapter. opticalHanging: true aligns eligible leading glyphs; native reasons
explain clipped/unsupported cases. Neither option is on by default for npm
entries; the automatic loader turns on hanging and 'en-declared' quotes
(below). styleProseLists(root)
plus typeset.us/styles.css styles only eligible unordered prose lists. Restore
its handle on teardown. Do not style navigation or ordered lists.

## Verify in a real browser

1. Capture source text, author element identity and focused link before applying.
2. Wait for fonts and controller readiness, or for whenSettled() (4.4, from
   typeset.us, typeset.us/react and window.Typeset). whenSettled({ timeout })
   resolves { settled: true } once every mount() controller and React
   adapter host has its outcome, no composition work is queued or timed, no
   web font is loading and a loader waiting for hydration has composed, at
   two checks 50 ms apart; { settled: false } if work remains at the timeout
   (default 10000 ms); at once under jsdom/happy-dom. Engine copies on one
   page share its list of work. It does not wait for hosts React has not
   mounted (pending Suspense), finite CSS animations, or offscreen blocks a
   resize left until they come near. Screenshot only after it.
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
native layout had), composition-constraint, unmeasurable, unprocessed,
clipped (text clipped on purpose: overflow hidden or clip with text-overflow:
ellipsis or -webkit-line-clamp, instead of an overflow error), untagged
(composed text with no lang, so English line-end preferences are off) and
uncomposed (nothing in scope composed, for a reason other than nothing to
improve, native:environment included); the last three are new in 4.4. Line-end
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

Read-only by default: it waits for the page's own composition to finish
(window.TypesetReady, or an outcome on every element in scope) for up to
--timeout seconds (30) per width. --apply composes only an isolated preview, never the
deployed site. Exit 0 is the documented safety/coverage gate; 1 fails it,
either because an audit failed or because the page threw an uncaught error
or an unhandled rejection at any width (a failing analytics script counts),
listed in the JSON's top-level "errors" with each report still passing on
its own; 2 is invocation/runtime failure. stdout is JSON; usage and runtime
errors go to stderr, and so does one "typeset-audit: warning:" line when
nothing in scope was composed (same exit code). --apply on a page without
Typeset previews what it would do there. Reports stay local. Do not upload
page text, project identity or results without consent.

## Upgrade and rollback

Read MIGRATION.md and SUPPORT.md inside this package. Keep the prior version pinned until
the pilot passes. New globals use window.Typeset. Restore or disconnect DOM
ownership, unmount React, restore list styling, and revert the recorded
dependency/deployment to roll back.

Loaders. The website go@4.4.0.js, and the identical typeset.us/auto
(dist/auto.js) in this package, compose p, li, blockquote, figcaption,
h1-h6, td, th, dd and dt with spacing, tracking, hanging punctuation and,
from 4.4, smartQuotes 'en-declared' (4.3 also curled untagged text;
data-typeset-smart-quotes="en" restores that, "false" turns quotes off).
They also compose content inside .demo and [data-no-smooth], which
go@4.2.0.js skipped (mark it data-no-typeset to keep it native). Override
the selector with data-typeset-selector; exclude content with
data-no-typeset. typeset.us/opt-in (dist/go.js) composes only [data-typeset]
or data-typeset-selector, with quotes and hanging off unless asked;
typeset.us/go is the same file, a deprecated alias kept until at least 5.0.
Bare jsDelivr/unpkg package URLs now serve dist/auto.js (4.3:
dist/typeset.global.js, which composes nothing by itself). Loader
attributes: data-typeset-selector, -smart-quotes, -optical-hanging,
-spacing, -tracking, -copy, -headings, -coverage and -defer.
Hydration: on a page with a server-rendering marker (#__next,
#__NEXT_DATA__, self.__next_f, #___gatsby, [data-framer-hydrate-v2],
astro-island, [data-server-rendered], or a React root on the document, body
or a child of the body) both loaders wait for the framework to hydrate
(React: each server-rendered target hydrated; Astro: no astro-island[ssr]
left except client:visible/media; Vue 2: no [data-server-rendered] left),
then one idle callback, at most 10 s, before their first composition, so
React reports no hydration error. data-typeset-defer="hydration" waits
without a marker; "none" composes at DOMContentLoaded, as 4.3 did. Without a
marker the timing is 4.3's. window.TypesetReady resolves after the first
composition. After the first pass each loader logs at most two
console.info notes (no lang on composed text; none of the matched blocks
composed, with the most common outcome), and one when nothing matches.
All old website pins remain immutable.

Outstanding external acceptance: physical iOS/Android; spoken VoiceOver/NVDA;
non-macOS and native-application rich clipboard; representative-device performance.
Owner approved release with these limits. Check the repository CI for exact
commit results; do not infer device certification from a green workflow.
