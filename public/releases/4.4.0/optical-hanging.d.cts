import type { LayoutMetrics } from './layout-metrics.cjs';
export interface OpticalHang {
    offset: number;
    px: number;
    overhang?: number;
}
export interface OpticalPlan {
    outcome: string;
    hangs: OpticalHang[];
}
/** Optical alignment is a rendering pass, never an extra line-breaking allowance. */
export declare function planOpticalHanging(element: HTMLElement, layout: LayoutMetrics): OpticalPlan;
/** A hanging marker is a spacing marker with a negative advance; `inline` as
 * in spacingMarkerStyle. */
export declare function opticalMarkerStyle(px: number, inline: boolean): Record<string, string>;
export declare function opticalVerified(element: HTMLElement, before: LayoutMetrics, after: LayoutMetrics, hangs: OpticalHang[]): boolean;
