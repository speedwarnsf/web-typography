# Typeset 4.2.0 Acceptance

Release date: September 17, 2026 (America/Los_Angeles).

## Published Artifact

- Engine commit: `2a17b59`, tag `v4.2.0`.
- npm: `typeset.us@4.2.0`, `latest` verified as 4.2.0.
- Public npm tarball is byte-identical to the accepted local tarball and website archive.
- SHA-512: `nPsQZwu2NNn4Y1w57BhX9QNOFTAXHHnGtc5kM6qprxHW0DHZBMD5D9IE7ze7nlB8apAhbGSRh92fTyCuDX6Q2A==`.
- Website deployment: `dpl_2GJEbLaGQPyAcANGp7uDE4dxNFPq`.
- Website URL: https://web-typography-7pcgzu6te-speed-warns-projects.vercel.app
- Previous website deployment: https://web-typography-a2fl3yr7y-speed-warns-projects.vercel.app
- Published 4.1.0 and older archives and browser pins are unchanged.

## Changes

1. Same-target mounts in one engine instance coordinate ownership. Waiting mounts cannot repeatedly overwrite the active composition. Ownership transfers on release; overlap counts remain observable.
2. Inline `white-space: nowrap` groups remove their internal break opportunities without excluding the surrounding linked or styled paragraph.
3. Conservative English name/designator grouping prefers breaks outside pairs such as Oak Street and Marquee Cinemas when they fit. No SceneF names or selectors are hardcoded in the engine.
4. Active rich compositions own `text-wrap-style: auto`, preventing browser pretty/balance from overriding chosen breaks. Ordinary wrapping and post-render verification remain enabled. Cleanup preserves author style changes.
5. Existing paragraph ranking, bounded word spacing, tracking and optical finishing are retained.

## Verification

- Local release matrix: 10,090 assertions, no failures, Chromium/WebKit/Firefox.
- Remote Linux acceptance: https://github.com/speedwarnsf/web-typography/actions/runs/35291576543
- Remote gate passed type checking, distributable rebuilding, browser regressions, production build, fresh packed npm installation, TypeScript consumer contracts, React browser consumers and stale-preview rejection.
- Final local website: 129 checks, no errors.
- Public website: 129 checks, no typography/runtime errors. Three occurrences of the pre-existing ntfy visitor-alert CORS failure were recorded separately; that external notification issue is not fixed by this release.
- Public proof/essay controls: 54 checks, no errors.
- SceneF production-build integration: 90 checks, no failures across 375px and 1440px in Chromium/WebKit/Firefox, including resize through 390px and 768px.
- Settled SceneF audits passed on Cape Coral, week and theaters at both widths in all three engines. Audit pass means safety and processed coverage, not absence of subjective review items.
- Source selection, copy-event output, link focus, client navigation, filters and Now controls were exercised. Browser copy-event tests are not physical-device or native-application clipboard certification.

At 375px all three engines produced:

```text
The End
of Oak Street

Marquee Cinemas
Coralwood
```

Picks remained stable over two-second sampling windows. Oak Street also remained together in the Final nights linked paragraph. Desktop text that already fit remained native.

## Performance

The final local production-build comparison used fresh browser contexts, Chromium with 4x CPU slowdown, 375px/1440px viewports, and identical replayed server documents for each on/off pair. Off disabled Typeset before mount, not after its startup work. All eight assertions passed with matching target text hashes.

The roughly 188,000px week page had 1,443 targets. At mobile width:

| Measurement | Off | On |
| --- | ---: | ---: |
| Longest startup main-thread task | 327 ms | 400 ms |
| Total startup blocking beyond 50 ms/task | 378 ms | 516 ms |
| Longest task during sampled scrolling | 68 ms | 76 ms |
| Total scroll blocking beyond 50 ms/task | 83 ms | 190 ms |

The largest observed engine batch was 23.3ms on week and 39.2ms across the full test. These are observations, not hard scheduling guarantees. The engine has a measurable cost; this result does not mean zero overhead. It does rule out the previously reported multi-second freeze in this test. The earlier third-party 6.5-second figure used a different build/corpus and is not a controlled numerical baseline for this release.

### Public Deployment Comparison

The same eight assertions passed against https://scenef.com with no runtime errors and matching target text hashes in every pair. The live week document contained 1,439 targets and was approximately 187,000px tall.

| Week measurement | Mobile off | Mobile on | Desktop off | Desktop on |
| --- | ---: | ---: | ---: | ---: |
| Longest startup main-thread task | 336 ms | 399 ms | 333 ms | 398 ms |
| Startup blocking beyond 50 ms/task | 410 ms | 707 ms | 378 ms | 447 ms |
| Longest sampled scroll task | 78 ms | 77 ms | 64 ms | 72 ms |
| Scroll blocking beyond 50 ms/task | 103 ms | 276 ms | 139 ms | 105 ms |

The largest observed engine batch was 26.6ms on week and 28.7ms across the live matrix. No one-second task was observed. This is a single on/off pair per viewport and page, not a statistically repeated device benchmark. Startup sampling ends after network idle, readiness and a settling delay; the intervals differ with network activity. Blocking totals are therefore diagnostic observations, not a precise isolated engine-cost estimate. Server-document replay also makes paint-time comparisons unsuitable as evidence of a load-time speedup. Physical-device responsiveness remains unverified.

Evidence: `output/scenef-startup-live-4.2.json` and `output/scenef-startup-local-4.2.json`.

## Remaining Limits

- English name grouping is a bounded heuristic, not semantic understanding of arbitrary names or brands.
- Narrow titles constrained to two lines may retain native layout when their permitted breaks require more space. The engine does not shrink fonts, invent hyphenation or remove author clamps.
- Unsupported formatting and failed geometry checks remain explicit native outcomes.
- Same-instance ownership does not make nested parent/child owners or separately bundled engine copies safe. SceneF uses disjoint selectors and one pinned package.
- Physical iOS/Android hardware, external screen-reader users and representative-device performance certification remain outside this acceptance.

Detailed machine-readable evidence is retained locally under `output/`, including `ci-4.2`, `scenef-integration-local-4.2.json` and `scenef-startup-4.2.json`.

## SceneF Rollout

- Commit: `2ad298c`, fast-forwarded to SceneF `master`.
- Registry dependency: exact `typeset.us@4.2.0`, matching the release integrity above.
- One package instance and one engine-bearing client chunk in the production build.
- Disjoint title and leaf-prose selectors cover poster titles, screening-row titles, venue labels and supported prose. Numeric UI and explicitly excluded controls keep their authored behavior.
- No font sizes, grids, clamps, marketing copy or site design were changed.
- The original SceneF checkout remained untouched; changes were made in an isolated worktree.
- Mandatory preflight passed type checking, the local fixture lane, production build and the bundle boundary gate. Live/server/outbound fixture lanes were not run; browser checks are separate evidence.
- Preflight fingerprint: `70e524e67548cf99`.
- Deployment: `dpl_Dm9AazkwJ6REKGyJ4f42XkkLzPB8`.
- Production URL: https://scenef-9wk8pmhrt-speed-warns-projects.vercel.app
- Production alias: https://scenef.com
- Previous deployment: https://scenef-k3hob8pkb-speed-warns-projects.vercel.app (`dpl_CU2rQBYSuje7hkELXKBk62PeC24s`).

### Live Follow-Up

All 90 functional checks passed against the public SceneF deployment, including zero layout jitter in two-second range-rectangle samples, correct venue grouping, exact source selection/copy handling, resize, filters and settled safety/coverage audits. Current visible titles remained targeted.

The End of Oak Street expired from the live Picks and Final nights while this work was underway. Twelve named-case checks (two per browser/viewport) were explicitly recorded as unavailable in the current listings, not claimed as live passes. The earlier production-build corpus and fixed name-group regressions retain the positive evidence for those exact examples.

WebKit's default Tab policy returned focus to the document body. The independent pre-mount-off/on comparison reproduced identical focus behavior, with both parity checks passing. Requiring a particular next link was not a valid cross-browser test oracle.

The strict live browser run is **not entirely clean**: WebKit reported access-control warnings for Next.js theater-page prefetch requests while navigating away from the theaters page. The trace also recorded cancelled requests in that same navigation phase. A separate, slower on/off navigation comparison had no errors and all captured prefetch responses were 200. Navigation and every functional check succeeded, but the transport warnings are retained as unresolved host/browser diagnostics, not erased or counted as engine failures that were fixed. See `output/scenef-integration-live-all-4.2.json`, `output/scenef-webkit-prefetch-trace-4.2.json`, and `output/scenef-webkit-parity-4.2.json`.
