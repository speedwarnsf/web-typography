import type { LayoutMetrics } from './layout-metrics.cjs';
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
export declare function planSpacingFinish(element: HTMLElement, layout: LayoutMetrics, measuredSpaces?: Map<string, number>): SpacingPlan;
/** Empty, noninteractive markers change advances, never source characters.
 * An empty inline span keeps its horizontal margin without becoming an atomic
 * inline: inline-block made Chromium drop the adjacent word space from its
 * accessibility tree ('careful notes' read as 'carefulnotes'). Only the
 * advance is per marker. The rest is the same for every marker and comes from
 * the engine's stylesheet (LIFECYCLE_CSS in lifecycle.ts); `inline` (where that
 * sheet cannot apply, see markerRules) writes it on the marker, as 4.3 did. */
export declare function spacingMarkerStyle(px: number, inline: boolean): Record<string, string>;
export declare function spacingVerified(element: HTMLElement, plan: SpacingPlan, after: LayoutMetrics): boolean;
