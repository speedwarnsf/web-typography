/**
 * Every outcome typeset(), mount(), planRichText() and the React adapters
 * report, as `Result.outcome` and `data-ts-outcome`, and every status the
 * finishing features report in `Result.features` and `data-ts-quotes`,
 * `data-ts-hanging`, `data-ts-spacing` and `data-ts-tracking`.
 *
 * What each code means and what to do about it is in outcome-docs.ts, which
 * generates OUTCOMES.md and docs/outcomes.md (npm run docs:outcomes) and is
 * not bundled. scripts/v4/verify-docs.mjs fails when a code appears in the
 * engine but not here, or here but not in the engine.
 *
 * TODO(docs-sync): 4.3 behaviour groups add codes (C3 declines justified
 * text, C4 live regions, C9/C10 print and translated pages). Add each here and
 * in outcome-docs.ts when those changes are integrated; verify-docs lists any
 * that are missing.
 */
export const OUTCOMES = [
  // Composed: Typeset chose the breaks.
  'composed', 'composed:rich',
  // Left as the browser set it, because there was nothing to improve.
  'native:fits', 'native:empty', 'native:sentence-aligned', 'native:paragraph-rhythm',
  // Left as the browser set it: content or styling Typeset does not handle.
  'native:language', 'native:mixed-language', 'native:script', 'native:direction', 'native:transformed',
  'native:decorated', 'native:whitespace', 'native:author-breaks', 'native:soft-hyphen', 'native:auto-hyphens',
  'native:break-policy', 'native:clamped', 'native:inline', 'native:ui',
  'native:rich-element', 'native:rich-excluded', 'native:rich-direction', 'native:rich-whitespace',
  'native:rich-layout', 'native:rich-box', 'native:rich-decorated', 'native:rich-tokens', 'native:react-component',
  // Left as the browser set it: Typeset could not improve it safely.
  'native:budget', 'native:no-candidate', 'native:line-budget', 'native:quality', 'native:render-failed', 'native:verification',
  // Not processed.
  'skipped:excluded', 'skipped:framework', 'unmeasurable',
] as const;

/** A `Result.outcome` / `data-ts-outcome` value. */
export type Outcome = typeof OUTCOMES[number];

/** Statuses of the finishing features, by feature. */
export const FEATURE_STATUSES = {
  quotes: ['off', 'enabled', 'applied', 'unchanged', 'native:quotes-scope'],
  hanging: ['off', 'applied', 'applied:partial', 'unchanged', 'native:hanging-layout', 'native:hanging-clipped', 'native:hanging-font', 'native:hanging-uncomposed', 'native:hanging-verification'],
  spacing: ['off', 'applied', 'unchanged', 'native:spacing-layout', 'native:spacing-measurement', 'native:spacing-mode', 'native:spacing-uncomposed', 'native:spacing-verification'],
  tracking: ['off', 'applied', 'unchanged', 'native:tracking-layout', 'native:tracking-measurement', 'native:tracking-budget', 'native:tracking-script', 'native:tracking-mode', 'native:tracking-uncomposed', 'native:tracking-verification'],
} as const;

export type QuoteStatus = typeof FEATURE_STATUSES.quotes[number];
export type HangingStatus = typeof FEATURE_STATUSES.hanging[number];
export type SpacingStatus = typeof FEATURE_STATUSES.spacing[number];
export type TrackingStatus = typeof FEATURE_STATUSES.tracking[number];
/** Any finishing-feature status. */
export type FeatureStatus = QuoteStatus | HangingStatus | SpacingStatus | TrackingStatus;
