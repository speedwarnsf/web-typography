# Moving from v3 to v4

This is the opt-in 4.0.0-beta.1 website release, not an update to npm latest.
Keep your v3 lockfile, deployed assets, and integration until acceptance passes.
Do not run two Typeset versions on the same content.

## What stays

The paragraph objective and its approved phrase/rhythm policies are unchanged
from alpha.7. Public low-level v3 exports remain available: tokenize,
composeParagraph, shapeExactLines, finalValidate, renderFrozenLines,
linesOverflow, and linesStarved. Those primitives do not provide v4 ownership,
rich-text, or lifecycle guarantees. Prefer mount/typeset for new integrations.

## Deliberate changes

| v3 behavior | v4 contract |
| --- | --- |
| Broad automatic script scope | Explicit mount scope; opt-in data-typeset script targets |
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
3. Install the candidate tarball; choose one DOM or React owner.
4. Capture source, links and screenshots before composition. Check mobile,
   desktop, resize, font loading, updates, copying and keyboard navigation.
5. Read auditJSON outcomes and reviews even when pass is true.
6. Disconnect the controller (restores by default), restore the list handle,
   or unmount the React adapter. Remove optional CSS. Restore the recorded v3
   dependency and deployment to roll back.

window.Typeset commands now mirror the public module: typeset, typesetAll,
mount, restore and auditJSON. Migrate old run/all/text/heading/compose/auto
aliases to these APIs. The global bundle does not auto-run; the separate go.js
loader mounts only [data-typeset] by default. See README.
