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
  { name: 'verify-golden', report: 'output/golden.json', note: 'composition byte-identical to 4.2.0 outside the recorded rendering changes' },
  { name: 'verify-acceptance', report: 'output/acceptance.json' },
  { name: 'verify-native-ax', report: 'output/native-ax.json', note: 'engine accessibility trees match the source (C1)' },
  { name: 'verify-inline-code', report: 'output/inline-code-regression.json' },
  { name: 'verify-inline-nowrap', report: 'output/inline-nowrap-regression.json' },
  { name: 'verify-name-groups', report: 'output/name-groups-regression.json' },
  { name: 'verify-wrap-ownership', report: 'output/wrap-ownership-regression.json' },
  { name: 'verify-controller', report: 'output/controller-regression.json' },
  { name: 'verify-mount-ownership', report: 'output/mount-ownership-regression.json' },
  { name: 'verify-tracking-clipping', report: 'output/tracking-clipping.json' },
  { name: 'verify-loaders', report: 'output/loaders.json' },
  { name: 'verify-fixture-invariants', report: 'output/fixture-invariants.json' },
  { name: 'verify-cli', report: 'output/cli-verification.json' },
  { name: 'verify-budgets', report: 'output/budget-verification.json', note: 'gzip size budgets (runtime budgets: --runtime, nightly)' },
];
