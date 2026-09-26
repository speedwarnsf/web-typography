import type { LayoutMetrics } from './layout-metrics.js';
export interface SpaceAdjustment {
    offset: number;
    px: number;
    naturalPx: number;
    line: number;
}
export interface SpacingPlan {
    outcome: string;
    adjustments: SpaceAdjustment[];
    before: LayoutMetrics;
}
export declare function naturalSpace(element: HTMLElement, style: CSSStyleDeclaration, text: string, cache: Map<string, number>): number;
/** Finish existing lines only. The V3 neighbor/median policy is unchanged;
 * each rich-text space gets a bound measured in its own styled context. */
export declare function planSpacingFinish(element: HTMLElement, layout: LayoutMetrics): SpacingPlan;
/** Empty, noninteractive markers change advances, never source characters. */
export declare function spacingMarkerStyle(px: number): Record<string, string>;
export declare function spacingVerified(element: HTMLElement, plan: SpacingPlan, after: LayoutMetrics): boolean;
