# typeset.us

**Paragraph compositor for the browser.** Beam-search line breaking with
syntactic protection, contour-shaped rag, hanging punctuation, and
post-render self-verification — the engine behind [typeset.us](https://typeset.us),
running live on every page of the site it ships from.

The browser types. It doesn't read. The case, set by its own subject:
[typeset.us/essay](https://typeset.us/essay).

## Install

One line, any site:

```html
<script src="https://typeset.us/go.js" defer></script>
```

Version-pinned with subresource integrity — the canonical snippet with the
current hash lives in [`public/sri.json`](public/sri.json), and published
pins are permanent: bytes never change, files are never removed.

Or from npm — ESM, CJS, and global builds with types:

```bash
npm install typeset.us@4.0.0
```

## Verification, not vibes

`Typeset.auditJSON(selector)` reports safety, coverage, native decisions and
feature outcomes. A pass requires a nonempty scope with no hard errors or
unprocessed targets; it is not aesthetic certification. Headings, captions,
list text and ordinary rich prose can all be targeted. The React adapters own
framework-updated text. Full contract: [typeset.us/for-agents](https://typeset.us/for-agents).
Read [migration](packages/typeset-v4/MIGRATION.md) and
[support](packages/typeset-v4/SUPPORT.md), including outstanding device testing.

## This repository

- [`src/lib/v4/`](src/lib/v4) — the approved V4 engine and adapters. The old source remains preserved separately.
- [`src/app/`](src/app) — the Next.js site (typeset.us). The site runs the same engine it ships.
- [`public/go.js`](public/go.js), `public/go@x.y.z.js`, [`public/sri.json`](public/sri.json) — generated drop-ins and their hashes (`npm run build:dist`).
- [`packages/typeset-v4/`](packages/typeset-v4) — the current npm package.
- [`public/releases/3.5.1/`](public/releases/3.5.1) — archived npm, browser and source artifacts; the old browser pin remains 3.5.0.
- [`docs/BINDING.md`](docs/BINDING.md) — how the phrase-binding weight was derived, and what the evidence does not support.
- [`CHANGELOG.md`](CHANGELOG.md) — what changed, including the bugs.

## Develop

```bash
npm run dev         # site at localhost:3000
npm run build:dist  # regenerate go.js, typeset.min.js, esm + npm artifacts
npm test            # current release: craft, spacing, promise and accessibility gates
npm run bench       # historical V3 benchmark; not a V4 performance claim
```

MIT © Dustin York — [typeset.us/support](https://typeset.us/support)
