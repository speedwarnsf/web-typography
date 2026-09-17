# typeset.us

## V4 website release

The homepage now presents **Typeset.ts 4.0.0-beta.1**, with a live rich-text
comparison, pinned downloads, and an agent-facing integration contract.
[Installation and migration](https://typeset.us/v4) |
[Agent instructions](https://typeset.us/for-agents.md).

```bash
npm install https://typeset.us/releases/4.0.0-beta.1/typeset.us-4.0.0-beta.1.tgz
```

V4 remains opt-in and is not npm latest. Its accepted compiled engine is kept in
`vendor/typeset-v4`; `npm run build:v4` verifies and packages its pinned assets.
`npm run build` includes that check. New pages use React adapters; legacy tools
retain their V3 engine. See `docs/v4/LAUNCH.md` for scope and launch material.

## Legacy V3

The following installation and implementation notes describe V3, not V4.

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
npm install typeset.us
```

## Verification, not vibes

The engine grades its own output. `Typeset.audit()` returns `[]` when a page
has no overflows, no orphaned last words, and no weak line ends — a
machine-checkable definition of done. Paragraphs report what happened via
`data-ts-outcome` (`composed`, `fallback:*`, `skipped:*`) and flag
`data-typeset-done` when decided. Full integration contract for humans and
agents: [typeset.us/for-agents](https://typeset.us/for-agents).

## This repository

- [`src/lib/typeset.ts`](src/lib/typeset.ts) — the engine. Everything shipped is generated from it.
- [`src/app/`](src/app) — the Next.js site (typeset.us). The site runs the same engine it ships.
- [`public/go.js`](public/go.js), `public/go@x.y.z.js`, [`public/sri.json`](public/sri.json) — generated drop-ins and their hashes (`npm run build:dist`).
- [`packages/typeset.us/`](packages/typeset.us) — the npm package.
- [`docs/BINDING.md`](docs/BINDING.md) — how the phrase-binding weight was derived, and what the evidence does not support.
- [`CHANGELOG.md`](CHANGELOG.md) — what changed, including the bugs.

## Develop

```bash
npm run dev         # site at localhost:3000
npm run build:dist  # regenerate go.js, typeset.min.js, esm + npm artifacts
npm test            # playwright: composition gates on the shipped bundles
npm run bench       # engine benchmarks
```

MIT © Dustin York — [typeset.us/support](https://typeset.us/support)
