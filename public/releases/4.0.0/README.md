# typeset.us 4

**4.0.0**, the next public major release after 3.5.1. Measured composition for
linked, styled and changing text. Install the versioned npm package:

```sh
npm install typeset.us@4.0.0
```

## DOM

```ts
import { mount, auditJSON, styleProseLists } from 'typeset.us';
import 'typeset.us/styles.css'; // optional bullet styling only

const lists = styleProseLists(document.querySelector('article')!);
const controller = mount(document, 'article p, article h2', {
  smartQuotes: 'en',       // optional, English quotes only
  opticalHanging: true,   // optional, reversible margin alignment
});
await controller.ready;
const report = auditJSON('article p, article h2');
console.log(report);      // inspect reviews and native outcomes, not just pass
// On teardown: controller.disconnect(); lists.restore();
```

Default composition uses Unicode opportunities, declared HTML lang and compact
density. Quotes/hanging are off by default. Content excluded with data-no-typeset
stays native. Scope to prose/titles, not UI or framework-owned content. mount
waits for fonts, observes updates/resizes and restores on disconnect. For one
element, await document.fonts.ready before typeset(element, options).

The full bounded word-spacing finish is on by default for composed body text.
It preserves the chosen line breaks and final line, without adjusting character
tracking or rebuilding author links/emphasis. Set `spacing: false` to compare
the unspaced composition; React adapters also accept `spacing={false}`.
`result.features.spacing` and `data-ts-spacing` distinguish applied, unchanged,
off, and declined finishing. If verification fails, only the finish is removed.
Paragraphs intentionally retained native are not secretly restyled.

V4 ranks body candidates using their predicted finished contour, with the same
measured-space policy used by the renderer. `contour: 'natural'` retains the
earlier ranking for comparison. `result.search` records completed/retained
candidate counts, eligible candidates, costs and the selected contour score.
The bounded search retains up to 200 completed candidates; short paragraphs
use exhaustive search within the declared budget.

## React

React is optional. The ESM-only entry includes its client-component directive:

```tsx
import { TypesetRichText, TypesetText } from 'typeset.us/react';

<TypesetRichText lang="en" smartQuotes="en" opticalHanging>
  {'"Read '}<strong>the notes</strong>{' at '}<a href="/gallery">the gallery</a>{'," she said.'}
</TypesetRichText>
<TypesetText as="h2" lang="en" mode="title" text={film.title} />
```

Use ordinary inline host markup. Independently stateful custom children retain
native rendering. Keep one owner per subtree. Framework-updated prose must not
also be targeted by a script loader or imperative mount. See [support](SUPPORT.md).

## Script and CSS

Self-host dist/typeset.global.js to expose window.Typeset without auto-running.
Self-host dist/go.js for explicit [data-typeset] targets; optional loader
attributes: data-typeset-selector, data-typeset-smart-quotes="en", and
data-typeset-optical-hanging="true". Set data-typeset-spacing="false" to disable
the default finish.

The existing website drop-in remains automatic:

```html
<script src="https://typeset.us/go@4.0.0.js" defer></script>
```

It targets paragraphs, headings, captions, list items and other prose blocks,
with English smart quotes and optical hanging enabled, as the previous
website loader did. Override targets with `data-typeset-selector=".headline, article p"`.
Use `data-no-typeset` to exclude an element and its descendants. Set
`data-typeset-smart-quotes="false"` or `data-typeset-optical-hanging="false"`
to disable these transformations. This automatic website loader differs from
the explicitly scoped npm `typeset.us/go` entry. Neither should own text that
a framework updates; use the framework adapter for that text.

Pinned module/global artifacts, migration notes and the npm tarball are at
https://typeset.us/releases/4.0.0/. Integrity hashes: https://typeset.us/sri.json.
Use dist/manifest.json for artifact SHA-384 integrity values. Load styles.css
once and add class="ts-styled" to prose ul elements for declarative list styling.

## Audit

```sh
npm install -D playwright
npx playwright install chromium
npx typeset-audit --url http://localhost:3000 --selector 'article p'
```

The CLI is read-only by default. --apply composes an isolated preview only.
No report is uploaded. Help works without Playwright installed. Exit 0 means
nonempty scope, no hard errors and no unprocessed targets, NOT perfect aesthetics.
Exit 1 fails that gate; exit 2 means invocation/runtime failure. Check outcomes,
review items and feature outcomes; capture source separately to prove preservation.

Exports: `typeset`, `typesetAll`, `mount`, `restore`, `auditReport`,
`audit`, `auditJSON`, `measureLayout`, `planRichText`, `VERSION`, and the
explicit legacy string helpers.
Optional React entry: `TypesetText` and `TypesetRichText`.

Rich plans report measured constraints when composition is declined.
English Unicode composition adds conservative phrase attachments and can
retain native sentence-aligned prose. This is a heuristic, not a syntax parser
or a guarantee of designer acceptance.
Read `for-agents.md` before integrating into framework-owned content.

Read [migration and rollback](MIGRATION.md), [support](SUPPORT.md), and
[agent instructions](for-agents.md). capabilities.json is the versioned machine
contract. ESM and CommonJS core have no required runtime dependencies. There
are no install hooks or telemetry. Old v3 pinned URLs remain unchanged; the
complete 3.5.1 rollback archive is at https://typeset.us/releases/3.5.1/.
