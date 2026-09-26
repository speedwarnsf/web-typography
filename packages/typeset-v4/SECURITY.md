# Security policy

typeset.us rewrites text inside other people's pages, so a flaw in it runs on
their sites. This page says which versions get fixes, how to report a
problem privately, and what happens next.

## Supported versions

| Version | Supported |
| --- | --- |
| 4.3.x | Yes: bug and security fixes |
| 4.2.x | Security fixes only |
| 4.0.x, 4.1.x | No. Upgrade to 4.3 |
| 3.x | No. 3.0.0 to 3.4.0 have a known DOM XSS (see below) |

Published files are never changed, including vulnerable ones: npm versions,
`/releases/<version>/` archives and `go@<version>.js` pins keep their bytes
so that pinned integrity hashes keep working. A fix ships as a new version.
Affected versions are listed under `advisories` in
https://typeset.us/release.json. npm does not mark the affected 3.x versions
deprecated yet.

## Reporting a vulnerability

Please do not open a public issue.

- Preferred: GitHub private vulnerability reporting, at
  https://github.com/speedwarnsf/web-typography/security/advisories/new
- Or email dyork@typeset.us with "typeset.us security" in the subject.

Include the version (`Typeset.VERSION`, or the loader URL), the browser, and
the smallest page or steps that show the problem. If the page is public, its
URL is enough.

## What happens next

- Acknowledgement within 3 business days.
- An assessment, with a severity and the affected versions, within 10
  business days.
- For a confirmed issue: a fixed release, a GitHub Security Advisory with a
  CVE where one applies, `npm deprecate` on the affected versions, and a
  CHANGELOG entry. Reporters are credited unless they ask not to be.

These are targets for a one-person project, not a contract. If you have not
heard back in 3 business days, send the email again.

## Scope

In scope: the `typeset.us` npm package, the files under
https://typeset.us/releases/ and https://typeset.us/go@*.js, and the
typeset.us website.

Out of scope: pages that pass untrusted HTML to Typeset, since Typeset
composes the DOM it is given and never parses HTML strings; reports that
need a malicious browser extension or a compromised device.

## Known advisories

- **DOM XSS in the 3.x `Typeset.auto()` heading branch.** 3.0.0 to 3.4.0
  (and the go@3.3.2.js and go@3.4.0.js pins) reparse the text of
  `[data-typeset-heading]` elements as HTML when a page calls
  `Typeset.auto()`, so escaped markup in that text runs. Fixed in 3.4.1;
  4.x does not have this code. Upgrade to 4.3, or to 3.4.1 or later if you
  must stay on 3.x. Advisory text, with a proof of concept:
  https://github.com/speedwarnsf/web-typography/blob/master/docs/security/advisory-3x-heading-xss.md.

## How releases are made

Releases are cut by `scripts/release-cut.mjs` and verified in CI. 4.3.0,
like 4.2.0, was published to npm by the maintainer account from the
reproducible tarball the cut recorded in the ledger, and the registry's
integrity is checked against the ledger; it has no npm provenance
attestation. The tag-triggered `release.yml` workflow publishes with npm
provenance once npm trusted publishing is configured for the package (see
`docs/OWNER-ACTIONS.md` in the repository). Every published file is recorded
by hash in https://typeset.us/releases/published.json, and CI fails if any
of them changes. The package has no runtime dependencies, no install scripts, and no
network access, storage or telemetry.
