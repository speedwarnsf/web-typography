## What and why

<!-- One or two sentences: what changes, and the problem it fixes. Link the issue. -->

## Rendering

- [ ] Default output is unchanged, or
- [ ] It changes to fix a verified defect: the CHANGELOG "Rendering changes" entry names the defect and the number of test paragraphs whose output changed (see STABILITY.md).

## Checks

- [ ] `npm test` passes (or the suites this touches: `npm test -- --only <name>`), and a new or changed check fails without this change.
- [ ] `npx tsc --noEmit` and `npm run typecheck:scripts` pass.
- [ ] Nothing under `public/releases/`, no `public/go@x.y.z.js` and no published entry in `public/releases/published.json` changed (CI enforces this).
- [ ] Docs describe the new behaviour (README, SUPPORT.md, OUTCOMES via `npm run docs:outcomes`, CHANGELOG).
