# Framework fixtures

`scripts/v4/verify-framework-text.mjs` renders the same four paragraphs with a
hand-rolled renderer that holds its Text nodes, React 19 (outside the Typeset
adapters), Svelte 5, Vue 3.5, Solid 1.9 and Lit 3, composes them with `mount()`
and with the website loader, and updates them twenty times.

- `src/` holds each app. `articles.js` is shared; it has no quotes, so the
  website loader's smart quotes leave the framework's text unchanged.
- `dist/` holds the Svelte, Vue, Solid and Lit apps bundled with their
  framework, so the suite needs no framework install. `versions.json` records
  the framework versions and `THIRD-PARTY-LICENSES.txt` their notices. The
  vanilla and React apps are bundled at test time from the repository's own
  dependencies.

Rebuild `dist/` after changing `src/`:

```sh
npm i --prefix <dir> svelte@5 vue@3.5 solid-js@1.9 lit@3
node scripts/v4/build-framework-fixtures.mjs --modules <dir>/node_modules
```

The build is deterministic: the same framework versions give the same bytes.
