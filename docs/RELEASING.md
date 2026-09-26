# Releasing typeset.us

A release is cut locally, reviewed and committed, and verified by CI. What
goes to npm is always the tarball the cut recorded in the ledger,
`public/releases/x.y.z/typeset.us-x.y.z.tgz`, never a fresh pack. Two
paths publish it:

- **The maintainer account**, until npm trusted publishing is configured
  ([OWNER-ACTIONS.md](OWNER-ACTIONS.md)). 4.2.0 and 4.3.0 were published
  this way; they have no npm provenance attestation.
- **`.github/workflows/release.yml`**, with npm provenance, once trusted
  publishing is configured.

## 1. Before the cut

- `CHANGELOG.md` has a dated section, `## x.y.z - YYYY-MM-DD`, with a
  "Rendering changes" subsection that lists every change to default output
  and its golden-diff count (see [STABILITY.md](../STABILITY.md)).
- The docs in `packages/typeset-v4/` describe x.y.z: `npm run test:v4`
  includes `verify-docs`, which checks install lines, options and links.
- CI is green on the commit you will cut from.
- The `node` first on your PATH is an official Node build (from
  nodejs.org, nvm or fnm; CI uses setup-node's node 22), not one linked to
  the system's zlib, such as Homebrew's: `node -p process.versions.zlib`
  prints a bundled version such as `1.3.1-470d3a2`, not `1.2.12`. The cut
  packs the tarball with the npm on your PATH, npm gzips it with the zlib
  of the node it runs on, and CI's release-check repacks it and compares
  bytes. Homebrew's node 25.5.0 packs 4.2.0's files into different bytes
  (sha1 `3821bfa…` for the published `c24c7c0…`) with npm 11.6.0 and 11.8.0
  alike, so a cut packed there would fail release-check after you tag it.
  The npm version does not change the bytes. `release-cut.mjs` repacks the
  previous release's files first and refuses to cut unless they come out
  byte for byte as the ledger records them.

## 2. Cut

```sh
npm run release:cut -- --version x.y.z --dry-run --verify   # rehearse, touches nothing
npm run release:cut -- --version x.y.z --summary "One sentence for the archive page."
```

`release-cut.mjs` refuses a version that exists in `public/releases/`, as a
pin, or on npm. Run the cut on the calibration machine: its staged run
enforces every check, including the speed-calibrated ones in
`scripts/v4/speed-calibrated.json`, which GitHub's slower hosted runners
report without enforcing (`TYPESET_HOSTED_RUNNER=1` in `ci.yml` and
`release.yml`). It builds, packs and runs every suite and the runtime budgets
in a staging directory, then writes `packages/typeset-v4/dist`,
`public/releases/x.y.z/`, the pins `go@x.y.z.js`, `typeset@x.y.z.min.js` and
`typeset@x.y.z.esm.js`, the aliases (`go@<major>.js`; `go.js` and the other
unversioned files only for 4.x), `sri.json`, `release.json`, and appends the
release to the ledger `public/releases/published.json`. It also drops the
entries in `scripts/v4/known-failures.json` that were waiting for this cut
(for example the 4.2.0 `sri.json` keys), so the tagged commit's
`test:release` does not report them as XPASS.

Review the diff, commit it, push, and wait for CI.

## 3. Tag and publish

Merge the release branch into `master` and push `master` before you tag.
The published docs link to the repository at `blob/master`: the package
README and MIGRATION.md to SECURITY.md, STABILITY.md, CHANGELOG.md and
docs/BENCHMARKS.md, both SECURITY.md files to the 3.x advisory, and
`docs/security/advisories.json`, whose `details` link the cut copies into
`public/release.json` and `public/sri.json`, to the advisory too. A file
that is only on the release branch (for 4.3.0: SECURITY.md, STABILITY.md,
the advisory and advisories.json) is a 404 on npm, on the website and in
the GitHub Release until `master` has it.

### Until trusted publishing is configured: the maintainer publishes

Publish before you push the tag, so the workflow finds the version on npm.
On the cut commit, with an official Node build and npm logged in as the
maintainer account:

```sh
node scripts/v4/verify-ledger.mjs --version x.y.z        # the tarball on disk is the ledger's
node scripts/v4/release-check.mjs --version x.y.z --ref HEAD   # the cut commit rebuilds it byte for byte
npm publish public/releases/x.y.z/typeset.us-x.y.z.tgz --access public --tag latest
node scripts/v4/verify-ledger.mjs --network --version x.y.z   # npm serves the ledger's integrity
git tag -s vx.y.z -m "typeset.us x.y.z"
git push origin vx.y.z
```

`release.yml` runs steps 1 to 3 below. `scripts/v4/registry-state.mjs`
finds the version on npm with the ledger's integrity, so step 5 does not
publish it again and skips the attestation check (a hand-published version
has no attestation), and step 6 creates the GitHub Release with notes that
say the maintainer account published it and that it has no provenance. If
npm serves the version with any other bytes, the workflow fails.

### With trusted publishing: the workflow publishes

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
4. waits for approval in the `npm` environment, then checks out the commit
   steps 1 to 3 verified (not the tag by name) and stops if the tag no
   longer names it;
5. publishes exactly `public/releases/x.y.z/typeset.us-x.y.z.tgz` with npm
   trusted publishing and `--provenance`, checks that the registry's
   integrity equals the ledger and that an attestation exists (a version
   npm already serves with the ledger's integrity is not published again,
   and one it serves with other bytes stops the workflow);
6. creates the GitHub Release from the CHANGELOG section
   (`scripts/v4/release-notes.mjs`, template in
   `.github/release-notes-template.md`) with the evidence JSON and the
   tarball attached, so the evidence does not expire with CI artifacts.

The published package has no `gitHead`: its bytes are fixed by the cut,
before the tag commit exists. For a version the workflow published, the
provenance attestation names the commit and the workflow run instead; for a
maintainer-published version, the ledger and step 2's byte-for-byte rebuild
from the tag tie the tarball to its sources.

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
