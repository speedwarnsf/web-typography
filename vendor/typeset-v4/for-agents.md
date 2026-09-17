# Typeset.ts V4: agent integration contract

Version: 4.0.0-beta.1. Channel: opt-in beta distributed from typeset.us.
Free and MIT licensed. No engine telemetry, install hook, account, or runtime
service. Existing /go.js and npm latest remain V3; never infer V4 from those URLs.

## Read before changing a client project

- https://typeset.us/v4/capabilities.json: supported scope, defaults, native reasons.
- https://typeset.us/v4/manifest.json: pinned artifacts, package and integrity.
- https://typeset.us/v4/acceptance.json: evidence and unverified acceptance areas.
- https://typeset.us/releases/4.0.0-beta.1/MIGRATION.md: upgrade and rollback.
- https://typeset.us/releases/4.0.0-beta.1/SUPPORT.md: support contract.

Start by comparing native CSS balance/pretty against Typeset on real content.
Use it where the comparison shows a benefit. Do not alter copy, font size,
width, or authored NBSPs just to manufacture a passing result. Native can be
the better result. An audit is not an aesthetic judgment.

## Install the exact package

```sh
npm install https://typeset.us/releases/4.0.0-beta.1/typeset.us-4.0.0-beta.1.tgz
```

The package is not on npm latest. Node 22+ for tooling. ESM and CommonJS core
have no required runtime dependencies. React and Playwright are optional peers.
The browser global is about 34 KB gzip; do not repeat V3's old 10 KB claim.

## Match rendering ownership

For DOM-owned prose:

```ts
import { mount, auditJSON } from 'typeset.us';
const controller = mount(document, 'article p');
await controller.ready;
const report = auditJSON('article p');
// On teardown:
controller.disconnect();
```

For React-owned prose use the ESM client adapter, never imperative mounting:

```tsx
import { TypesetRichText } from 'typeset.us/react';
<TypesetRichText id="story" lang="en">
  Read <strong>the story</strong> at <a href="/journal">our journal</a>.
</TypesetRichText>
```

React 19.2.3 and Next 16.1.6 were tested. Do not claim React 18 coverage.
Ordinary inline host elements are supported; independently stateful component
children retain native rendering. Never let V3 and V4 own the same subtree.

For non-framework HTML use the pinned go.js URL and SRI in manifest.json.
The loader targets [data-typeset] only. It exposes window.TypesetReady.
The manual global typeset.global.js exposes window.Typeset without autorun.

## Craft is explicit

- Defaults: Unicode breaks, compact density, no quote rewriting or hanging.
- smartQuotes:'en' educates English quotes only. Displayed/copied punctuation
  intentionally changes. Rich React also requires lang="en" on the adapter.
- opticalHanging:true aligns eligible leading glyphs. It is declined for
  clipped/transformed/indented/centered/justified contexts and verified output.
- styleProseLists(root) plus typeset.us/styles.css uses native unordered-list
  markers. Restore the handle on teardown. Navigation/ordered/custom lists are
  excluded. Never invent list semantics with injected decorative characters.

## Verify, and report the decision

1. Record source text, focused links and author element identity before applying.
2. Wait for fonts and controller readiness. Compare at mobile and desktop widths.
3. Require exact source unless quote education was intentionally enabled; then
   compare against smartQuotes(original). Never accept duplicate links or lost emphasis.
4. Check keyboard activation, selection, plain/rich copying, resize, font loading,
   source updates, and teardown. Include selections crossing paragraph boundaries.
5. Inspect auditJSON(selector): schemaVersion, pass, errors, reviews, unprocessed,
   outcomes, feature outcomes and issues. Empty scope fails. A pass means only
   a nonempty scope with no hard errors and no unprocessed targets.
6. Report composed and native:* outcomes separately. Review items need judgment.
   native:no-candidate may identify an unbreakable run or a line budget; do not
   describe every native result as a failure, or every fallback as perfection.
7. Keep the prior dependency/script pin. Roll back if the pilot regresses.

Horizontal LTR Latin prose/titles; declared English, French, German and Spanish.
Untagged Latin uses neutral preferences. RTL, vertical text, mixed-language
blocks, editable text, inline widgets and unsupported CSS retain native layout.
At extreme zoom or text sizes, author CSS can still overflow. The audit reports
this. Author-enabled overflow-wrap:anywhere retains native:break-policy.

## CLI for repeatable checks

```sh
npm install -D playwright
npx playwright install chromium
npx --no-install typeset-audit --url http://localhost:3000 --selector 'article p'
```

Read-only by default. --apply modifies an isolated preview, not the deployed
site. Exit 0 passes the documented coverage/safety gate; 1 fails it; 2 is an
invocation/runtime error. stdout is JSON. Reports stay local. Do not upload
client text or add adoption tracking without the project owner's consent.

## Evidence boundaries

12,966 comparison/fuzz cases and 1,342 recorded checks; tested in Chromium,
WebKit and Firefox. Real macOS clipboard checks and a clean Node 22 local
workflow passed. 120 local performance samples are not a physical-phone claim.
Physical iOS/Android, spoken VoiceOver/NVDA, representative-device performance
and remote CI acceptance remain unverified. No universal flawless-results claim.

Legacy V3 contract: https://typeset.us/for-agents-v3.md
