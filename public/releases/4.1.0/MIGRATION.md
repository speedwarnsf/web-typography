# Moving to 4.1.0

4.1.0 follows public 4.0.0. The internal 4.0.1-dev labels were private candidates,
not public releases. There are no renamed public APIs or required runtime peers.

## From 4.0.0

1. Retain the current lockfile/deployment. Disconnect the old controller before
   replacing it; never mount two versions on the same text.
2. Install typeset.us@4.1.0, or change the website pin to
   https://typeset.us/go@4.1.0.js and use its new hash from sri.json.
3. Keep one DOM mount or React adapter per subtree. Remove repeated whole-page
   passes on font events, animation frames or timers: mount already waits for
   fonts and recomposes actual text, font, geometry and context changes.
4. Check mobile/desktop source, links, selection/copying, updates and teardown.
   Inspect feature outcomes and native reasons even when auditJSON passes.

The body finish now adds bounded per-line tracking after word spacing, preserving
chosen breaks and the final line. Set tracking: false to keep word spacing only,
or spacing: false to disable both; both React adapters support these options.
Script equivalents: data-typeset-tracking="false" / data-typeset-spacing="false".
No adjustment is claimed for runs the tracking pass declines.

Supported sliced inline-code boxes and pure 2D translation no longer force
native layout. Hanging can work inside a clip when the actual full glyph fits
the available margin/padding; unknown clipping and unsupported font contexts
still decline. Default body layout may add one line to repair a stranded
sentence/clause opener; explicit compact density/maxLines remain respected.

Rollback: disconnect/unmount, restore list styling if used, restore the recorded
deployment and npm install typeset.us@4.0.0 or pin go@4.0.0.js with its original
integrity hash. Its package, docs and browser assets remain immutable at
https://typeset.us/releases/4.0.0/.

## Historical v3 to v4 migration

4.0.0 follows public 3.5.1. Keep your v3 lockfile, deployed assets and integration
until your own acceptance passes. Old pins remain available and unchanged.
Do not run two Typeset versions on the same content.

## What stays

V4 re-ranks candidates using predicted finished widths; 4.1.0 also repairs
sentence/clause-opener classification and its default body line allowance.
`contour: 'natural'` selects the prior ranking. Public low-level v3 exports remain available: tokenize,
composeParagraph, shapeExactLines, finalValidate, renderFrozenLines,
linesOverflow, and linesStarved. Those primitives do not provide v4 ownership,
rich-text, or lifecycle guarantees. Prefer mount/typeset for new integrations.

## Deliberate changes

| v3 behavior | v4 contract |
| --- | --- |
| Bounded per-line word spacing | Full default finish after body composition; styled-run bounds and reversible space markers |
| Broad automatic script scope | Website go.js keeps its broad scope; npm /go uses opt-in data-typeset targets |
| English-oriented default | Unicode path using declared en/fr/de/es; untagged Latin uses neutral preferences |
| Automatic quote/dash/ellipsis education | smartQuotes: 'en' explicitly enables quotes only |
| Optical margin alignment during composition | opticalHanging: true explicitly enables a verified rendering pass |
| Injected CSS and pseudo-bullets | Import styles.css and call styleProseLists, or use ul.ts-styled declaratively |
| Framework-owned text excluded | Use TypesetText or TypesetRichText, never overlapping imperative ownership |
| Empty audit array used as success | auditJSON reports safety, coverage, reviews, native and feature outcomes |
| typeset() returns void | typeset() returns a measured Result |

`lineBreaks: 'legacy'` retains the candidate's earlier break-opportunity path.
It is NOT identical v3 rendering or v3 side effects. Its plain renderer can
replace Text nodes; use default Unicode for the new identity/selection behavior.
Keep v3 installed if exact v3 behavior is required during migration.

Compared with beta.1, the default Unicode/rich renderer now finishes composed
body lines using the approved V3 neighbor/median spacing policy. This can change
line widths, not the selected line membership or final line. `spacing: false`
disables finishing for comparison in DOM and both React adapters. The script
loader accepts `data-typeset-spacing="false"`. Inspect `features.spacing` or
`data-ts-spacing`: `native:spacing-verification` retains the composed breaks
without the finish, rather than returning the entire paragraph to native layout.

`typesetText` and `typesetHeading` remain legacy string helpers, including quote,
dash, ellipsis and NBSP transformations. They are not measured browser layout.
`smartQuotes(text)` is English quotes-only: length preserving, with double
hyphens, ellipses and numeric feet/inches left alone. Ambiguous punctuation
cannot be inferred perfectly; opt in only for prose you own.

Smart quotes deliberately change copied text to the displayed quotes. DOM
restore reverses unchanged owned quote edits; external edits win. React renders
from original props. Rich React quote conversion requires lang="en" on the
adapter so SSR does not guess inherited language. Mixed-language/code trees
decline quote conversion. For custom components, educate source strings before
passing them to the component.

Lists retain native ::marker semantics. --ts-bullet-content, --ts-bullet-color
and --ts-bullet-size remain available; include trailing space in custom content.
New --ts-bullet-indent and --ts-bullet-gap control spacing. Native markers do
not support the old --ts-bullet-top or --ts-bullet-opacity; use native baseline
alignment and alpha in marker color instead. Ordered numbering is untouched.

## Integration and rollback

1. Record v3 version and retain the lockfile/deployment.
2. Remove the old script/controller from the pilot scope.
3. Install typeset.us@4.1.0; choose one DOM or React owner.
4. Capture source, links and screenshots before composition. Check mobile,
   desktop, resize, font loading, updates, copying and keyboard navigation.
5. Read auditJSON outcomes and reviews even when pass is true.
6. Disconnect the controller (restores by default), restore the list handle,
   or unmount the React adapter. Remove optional CSS. Restore the recorded v3
   dependency and deployment to roll back.

window.Typeset commands now mirror the public module: typeset, typesetAll,
mount, restore and auditJSON. Migrate old run/all/text/heading/compose/auto
aliases to these APIs. The global bundle does not auto-run; the separate go.js
loader in npm mounts only [data-typeset] by default. The website go.js retains
the automatic prose/headings scope; use data-typeset-selector to narrow or
replace it. Its craft defaults preserve the previous one-line installation.
See README. Roll back to https://typeset.us/go@3.5.0.js for the old browser
engine, or npm install typeset.us@3.5.1 for the old package. Source and package
archives: https://typeset.us/releases/3.5.1/.
