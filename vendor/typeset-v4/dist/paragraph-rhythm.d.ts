import type { LayoutMetrics } from './layout-metrics.js';
/** Preserve an already even paragraph only when recomposition clearly disrupts it. */
export declare function retainParagraphRhythm(source: string, before: LayoutMetrics, proposedWidths: readonly number[]): boolean;
