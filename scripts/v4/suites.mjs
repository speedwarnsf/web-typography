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
  { name: 'verify-break-semantics', report: 'output/break-semantics.json', note: 'generated breaks are word separators; markers paint nothing (C2)' },
  { name: 'verify-strict-csp', report: 'output/strict-csp.json', note: "style-src without 'unsafe-inline' and Trusted Types (C5)" },
  { name: 'verify-copy-privacy', report: 'output/copy-privacy.json', note: 'no hidden content on the clipboard (C11)' },
  { name: 'verify-framework-text', report: 'output/framework-text.json', note: 'framework text updates never show stale text (C6)' },
  { name: 'verify-live-regions', report: 'output/live-regions.json', note: 'live regions are never composed (C4)' },
  { name: 'verify-smart-quotes', report: 'output/smart-quotes.json', note: 'quote education table, server-rendered quotes (C15)' },
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
