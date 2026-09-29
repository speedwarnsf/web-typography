# Stability

Typeset changes how other people's pages look, so what a version number
promises matters more than for most libraries. This is the promise.

## What semver covers

From 4.3.0, a minor or patch release never breaks these:

- **API names.** Exports, options, React props, loader attributes
  (`data-typeset-*`) and CLI flags keep their names and meaning. New ones
  may be added.
- **auditJSON.** `schemaVersion` stays 1 in 4.x and existing fields keep
  their shape. New issue types and fields may be added; a new issue type
  can make an audit that used to pass fail, and the CHANGELOG says so.
- **Outcome codes.** Codes in `OUTCOMES` keep their meaning and are never
  renamed or removed in 4.x. New codes may be added; the `Outcome` type
  is written so code that switches over it keeps compiling.
- **CLI exit codes.** `typeset-audit` exits 0, 1 or 2 as documented.
- **Default rendering.** See below.
- **Published files.** An npm version, a `/releases/<version>/` archive and
  a `go@<version>.js` or `typeset@<version>.*.js` pin never change after
  release, byte for byte. CI checks this against the ledger at
  https://typeset.us/releases/published.json.

## Default rendering

A minor or patch release changes how text is set by default only to fix a
verified defect: an accessibility failure, lost or corrupted text, overflow,
or a layout the engine's own checks should have refused. Each such change is
listed in the CHANGELOG under "Rendering changes", with the number of test
paragraphs whose output changed. Any other change to default output ships
behind an option, off by default, or waits for a major version.

## Installing so nothing changes under you

- npm: `npm i -E typeset.us@4.3.1` saves the exact version. A caret range
  (`^4.3.1`) takes minor releases automatically, including their listed
  rendering changes.
- Script tag: use the pinned loader with its integrity hash, from
  https://typeset.us/sri.json:

  ```html
  <script src="https://typeset.us/go@4.3.1.js" integrity="sha384-PQvP42IgERdCbNk9MWI9BkD7n+k1WbL6ImFN3cAMbXQq25PhdJynmVXQM0UB3ksB" crossorigin="anonymous" defer></script>
  ```

- `go@4.js` follows the latest 4.x release. `go.js` is for trying Typeset
  out: it also follows 4.x, and it will never move to 5.0. Neither can carry
  an integrity hash, because their bytes change with each release.

## Cadence and support

- At most one minor release every two to four weeks; patches as needed.
- The previous minor line gets security fixes (see SECURITY.md); 4.2.x does
  now.
- Anything deprecated is announced in the CHANGELOG at least one minor
  release before a major version removes it.
