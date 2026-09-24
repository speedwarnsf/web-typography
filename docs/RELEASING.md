# Releasing typeset.us

A release is cut locally, reviewed and committed, then published by CI from
a tag. Nothing is published from a laptop.

## 1. Before the cut

- `CHANGELOG.md` has a dated section, `## x.y.z - YYYY-MM-DD`, with a
  "Rendering changes" subsection that lists every change to default output
  and its golden-diff count (see [STABILITY.md](../STABILITY.md)).
- The docs in `packages/typeset-v4/` describe x.y.z: `npm run test:v4`
  includes `verify-docs`, which checks install lines, options and links.
- CI is green on the commit you will cut from.

## 2. Cut

```sh
npm run release:cut -- --version x.y.z --dry-run --verify   # rehearse, touches nothing
npm run release:cut -- --version x.y.z --summary "One sentence for the archive page."
```

`release-cut.mjs` refuses a version that exists in `public/releases/`, as a
pin, or on npm. It builds, packs and runs every suite and the runtime budgets
in a staging directory, then writes `packages/typeset-v4/dist`,
`public/releases/x.y.z/`, the pins `go@x.y.z.js`, `typeset@x.y.z.min.js` and
`typeset@x.y.z.esm.js`, the aliases (`go@<major>.js`; `go.js` and the other
unversioned files only for 4.x), `sri.json`, `release.json`, and appends the
release to the ledger `public/releases/published.json`.

Review the diff, commit it, push, and wait for CI.

## 3. Tag and publish

```sh
git tag -s vx.y.z -m "typeset.us x.y.z"   # on the cut commit
git push origin vx.y.z
```

`.github/workflows/release.yml` then:

1. requires the CI workflow to have passed on the tagged commit;
2. runs `scripts/v4/release-check.mjs`: versions agree, the ledger's files
   are unchanged, and `release-cut --dry-run` on the tag rebuilds the npm
   tarball, every archived file and the pinned loader byte for byte;
3. runs `npm run test:release` against the committed dist;
4. waits for approval in the `npm` environment;
5. publishes exactly `public/releases/x.y.z/typeset.us-x.y.z.tgz` with npm
   trusted publishing and `--provenance`, checks that the registry's
   integrity equals the ledger and that an attestation exists;
6. creates the GitHub Release from the CHANGELOG section
   (`scripts/v4/release-notes.mjs`, template in
   `.github/release-notes-template.md`) with the evidence JSON and the
   tarball attached, so the evidence does not expire with CI artifacts.

The published package has no `gitHead`: its bytes are fixed by the cut,
before the tag commit exists. The provenance attestation names the commit and
the workflow run instead.

Rehearse steps 1 to 3 on any tag with Actions > Release > Run workflow; the
rehearsal runs `npm publish --dry-run` and never publishes.

## 4. After publishing

- Deploy the website from the tagged commit (`vercel --prod`), then run
  `node scripts/field/verify-cdn-reachability.mjs` and
  `node scripts/field/verify-public-site.mjs`.
- `node scripts/v4/verify-ledger.mjs --network` (also nightly).

## Cadence

At most one minor release every two to four weeks; patches as needed. See
[STABILITY.md](../STABILITY.md).

## One-time setup

The repository and registry settings this process relies on are in
[OWNER-ACTIONS.md](OWNER-ACTIONS.md).
