# Moving to 4.3.0

4.3.0 follows 4.2.0. It is a minor release: no public API was renamed or
removed, and nothing new is required. Default rendering changes only where
4.2.0 had a verified defect; each change is listed under "Rendering changes"
in the CHANGELOG with the number of test paragraphs it changed.

## From 4.2.0

1. Keep your current lockfile and deployment until your own checks pass.
   Disconnect the old controller, or unmount the React adapters, before
   replacing the engine. Never run two Typeset versions on the same text.
2. Install the exact version: `npm i -E typeset.us@4.3.0`, or change the
   script pin to `go@4.3.0.js` with its integrity hash from
   https://typeset.us/sri.json.
3. React 18.2 and later now install without `--legacy-peer-deps`, and
   Playwright is no longer a peer. If you added either workaround for 4.2,
   remove it.
4. If you self-host or use jsDelivr and want every paragraph composed, use
   `typeset.us/auto` (`dist/auto.js`), the same file as the typeset.us
   loader. `typeset.us/go` still composes only `[data-typeset]`, and now says
   so in the console when nothing matches.
5. Re-run `auditJSON()` or `npx typeset-audit`. 4.3 audits two accessibility
   conditions that 4.2.0's own output had (`hidden-break`, `isolated-space`);
   4.3.0's output no longer has them.
   <!-- TODO(docs-sync): confirm once C2 is integrated. -->
6. Check the "Rendering changes" list in the CHANGELOG against your pages.
   <!-- TODO(docs-sync): C2, C3, C4, C9, C13 and C15 fill that list; summarise
   any change a site owner must act on here (for example justified text is
   now declined with native:justify). -->

New and optional in 4.3: the `Outcome` and `FeatureStatus` types and the
`OUTCOMES` list (OUTCOMES.md explains every code), and typed
`result.outcome` and `result.features`. Existing code keeps compiling:
the types still accept any string.
<!-- TODO(docs-sync): K5 (React refs, a wider `as`, onResult), K11 (option
validation) and C9 (break display option) add API; list them here. -->

Rollback: restore the recorded lockfile and deployment, or
`npm i -E typeset.us@4.2.0`, or pin `go@4.2.0.js` with its original
integrity hash. https://typeset.us/releases/4.2.0/ stays byte for byte as
published.

## Earlier versions

Each release's own guide stays in its archive, unchanged:

- 4.1.0 to 4.2.0: https://typeset.us/releases/4.2.0/MIGRATION.md
- 4.0.0 to 4.1.0: https://typeset.us/releases/4.1.0/MIGRATION.md
- 3.x to 4.0.0: https://typeset.us/releases/4.0.0/MIGRATION.md

Moving from 3.x: typeset.us 3.0.0 to 3.4.0 and the go@3.3.2.js and
go@3.4.0.js pins have a DOM XSS when a page calls `Typeset.auto()` on
`[data-typeset-heading]` text an attacker can influence. Those files stay
online unchanged, like every published file, and are deprecated on npm. Move
to 4.3, or at least to 3.4.1. Details:
https://github.com/speedwarnsf/web-typography/blob/master/SECURITY.md
