/**
 * The coverage option: what composes beyond what 4.3 composed. 'extended'
 * also composes paragraphs 4.3 left native: text declared in any
 * Latin-script language (with neutral line-end preferences, as for untagged
 * text), a descendant declared in another Latin-script language, time, dfn,
 * kbd and ins, visually hidden text, and sup and sub. 'core' leaves those
 * native, exactly as 4.3.1 did. Verified-defect fixes (language tags such as
 * en_US, Greek and Cyrillic letters in Latin text, smart quotes, the run
 * budget) apply under both.
 */
export type Coverage = 'extended' | 'core';

/** The default of the coverage option, for every entry point. STABILITY.md
 * lets a minor release compose more by default only if the owner accepts
 * the "Default rendering" addition (decision O1 for 4.4.0); otherwise this
 * one constant becomes 'core'. */
export const COVERAGE_DEFAULT: Coverage = 'extended';

/** Whether options ask for extended coverage, the default applied. */
export const extendedCoverage = (coverage: Coverage | undefined): boolean => (coverage ?? COVERAGE_DEFAULT) === 'extended';
