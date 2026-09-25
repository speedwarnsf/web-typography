// @ts-check
// The suites test:v4 runs, in order, and where each writes its report.
/** @typedef {{ name: string, report?: string, note?: string }} Suite */
/** @type {Suite[]} */
export const SUITES = [
  { name: 'verify-ledger', report: 'output/ledger-verification.json', note: 'published artifacts unchanged' },
  { name: 'verify-immutable-4.2', report: 'output/immutable-4.2.json', note: '4.2.0 byte-for-byte' },
  { name: 'verify-ledger-guards', report: 'output/ledger-guards.json', note: 'the ledger catches tampering' },
  { name: 'verify-release-craft', report: 'output/release-craft.json' },
  { name: 'verify-spacing', report: 'output/spacing.json' },
  { name: 'verify-promise', report: 'output/promise.json' },
  { name: 'verify-acceptance', report: 'output/acceptance.json' },
  { name: 'verify-native-ax', report: 'output/native-ax.json', note: 'engine accessibility trees match the source (C1)' },
  { name: 'verify-inline-code', report: 'output/inline-code-regression.json' },
  { name: 'verify-inline-nowrap', report: 'output/inline-nowrap-regression.json' },
  { name: 'verify-name-groups', report: 'output/name-groups-regression.json' },
  { name: 'verify-wrap-ownership', report: 'output/wrap-ownership-regression.json' },
  { name: 'verify-controller', report: 'output/controller-regression.json' },
  { name: 'verify-mount-ownership', report: 'output/mount-ownership-regression.json' },
  { name: 'verify-iframe-mount', report: 'output/iframe-mount.json', note: 'mount() into a same-origin iframe (C12)' },
  { name: 'verify-recompose-storms', report: 'output/recompose-storms.json', note: 'ancestor mutations recheck a layout key, not recompose (P3)' },
  { name: 'verify-reflow-triggers', report: 'output/reflow-triggers.json', note: 'fonts, spacing overrides and metric transitions recompose (C7)' },
  { name: 'verify-visibility', report: 'output/visibility.json', note: 'hidden text keeps its composition and reveals composed (C8)' },
  { name: 'verify-print-resize', report: 'output/print-resize.json', note: 'no double-wrapped frame in print or while resizing (C9)' },
  { name: 'verify-scheduler', report: 'output/scheduler.json', note: 'busy pages, visible-first work, deferred offscreen resizes (P2)' },
  { name: 'verify-translation', report: 'output/translation.json', note: 'composition steps aside for machine translation (C10)' },
  { name: 'verify-options', report: 'output/options.json', note: 'clear errors and development option warnings (K11)' },
  { name: 'verify-tracking-clipping', report: 'output/tracking-clipping.json' },
  { name: 'verify-loaders', report: 'output/loaders.json' },
  { name: 'verify-fixture-invariants', report: 'output/fixture-invariants.json' },
  { name: 'verify-cli', report: 'output/cli-verification.json' },
  { name: 'verify-budgets', report: 'output/budget-verification.json', note: 'gzip size budgets (runtime budgets: --runtime, nightly)' },
];
